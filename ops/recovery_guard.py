"""Local recovery contract v1. Import and default execution have no effects.

No capture, extraction, migration, transport, target writer or cleanup executor
exists here. Future callers must collect fresh safe metadata, supply accepted
final inputs, revalidate immediately before each write, and retain exclusive
custody. A validation receipt is not a persistent permission or restore proof.
Opaque archives are hashed, never interpreted as database/map/key contents.
"""
from datetime import datetime
import hashlib
import ipaddress
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat

HOST = 'varcamp.3-1-133-135.sslip.io'
PORTS = {'play': 18443, 'idp': 18444, 'maps': 18445, 'icons': 18446}
ROLES = {
    'maps': {'maps_archive', 'maps_inventory', 'native_metadata'},
    'postgres': {'postgres_archive', 'postgres_prerequisites'},
    'redis': {'redis_rdb', 'redis_policy'},
    'deployment': {'deployment_config', 'deployment_lock'},
    'h2': {'h2_archive', 'h2_patch', 'h2_provenance'},
    'acme': {'acme_offline'},
}
METHODS = {'maps': 'coordinated-readonly-tree', 'postgres': 'pg_dump-custom-17.6',
           'redis': 'completed-rdb', 'deployment': 'frozen-final-config',
           'h2': 'verified-local-artifact', 'acme': 'coordinated-offline-copy'}
RESOURCE_KINDS = ('volumes', 'binds', 'networks', 'services')


class GuardError(ValueError):
    """Stable v1 error code; message deliberately contains no input values."""
    def __init__(self, code):
        self.code = code
        super().__init__('recovery-guard-v1:' + code)


def require(condition, code='SCHEMA'):
    if not condition:
        raise GuardError(code)


def object_keys(value, keys, code='SCHEMA'):
    require(type(value) is dict and set(value) == set(keys), code)


def text(value, code='SCHEMA'):
    require(type(value) is str and bool(value) and len(value) <= 4096 and
            not any(ord(c) < 32 or ord(c) == 127 for c in value), code)
    return value


def number(value, minimum=0, code='SCHEMA'):
    require(type(value) is int and value >= minimum, code)
    return value


def sha(value, code='SCHEMA'):
    require(type(value) is str and re.fullmatch('[0-9a-f]{64}', value) is not None, code)
    return value


def digest(data):
    return hashlib.sha256(data).hexdigest()


def contract_hash(value):
    """V1 contract hash binds sorted JSON with its single trailing newline."""
    return digest((json.dumps(value, sort_keys=True) + '\n').encode())


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def _json(data):
    try:
        return json.loads(data, object_pairs_hook=_pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(GuardError('SCHEMA')))
    except (ValueError, UnicodeError, RecursionError):
        raise GuardError('SCHEMA') from None


def relative_path(value):
    text(value, 'PATH')
    p = PurePosixPath(value)
    require(not p.is_absolute() and '\\' not in value and
            all(c not in ('', '.', '..') for c in value.split('/')) and str(p) == value, 'PATH')
    return value


def absolute_path(value, code='ISOLATION'):
    text(value, code)
    p = PurePosixPath(value)
    require(p.is_absolute() and str(p) == value and '\\' not in value and
            all(c not in ('', '.', '..') for c in value.split('/')[1:]) and value != '/', code)
    return value


def _identity(st):
    return (st.st_dev, st.st_ino, st.st_mode, st.st_uid, st.st_gid,
            st.st_nlink, st.st_size, st.st_mtime_ns, st.st_ctime_ns)


class _Custody:
    """Descriptor-relative NOFOLLOW traversal, private modes, stable reads."""
    def __init__(self, root, uid, gid):
        number(uid); number(gid)
        self.uid, self.gid = uid, gid
        self.fd = None
        self.files = {}
        self.directories = {}
        raw = os.fspath(root)
        absolute_path(raw, 'CUSTODY')
        fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
        try:
            for part in raw.split('/')[1:]:
                nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                os.close(fd)
                fd = nxt
            self.fd = fd
            self._walk(fd, '')
        except (OSError, GuardError):
            os.close(fd)
            self.fd = None
            raise GuardError('CUSTODY') from None

    def _check(self, st, directory=False):
        require(st.st_uid == self.uid and st.st_gid == self.gid and
                stat.S_IMODE(st.st_mode) == (0o700 if directory else 0o600) and
                (stat.S_ISDIR(st.st_mode) if directory else stat.S_ISREG(st.st_mode)), 'CUSTODY')
        if not directory:
            require(st.st_nlink == 1, 'CUSTODY')

    def _walk(self, fd, prefix):
        st = os.fstat(fd)
        self._check(st, True)
        self.directories[prefix] = _identity(st)
        for name in os.listdir(fd):
            relative_path(name)
            st = os.stat(name, dir_fd=fd, follow_symlinks=False)
            path = prefix + name
            if stat.S_ISDIR(st.st_mode):
                child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                try:
                    self._walk(child, path + '/')
                finally:
                    os.close(child)
            else:
                self._check(st)
                self.files[path] = _identity(st)

    def read(self, path, metadata=False):
        relative_path(path)
        require(path in self.files, 'CUSTODY')
        fd = os.dup(self.fd)
        try:
            parts = path.split('/')
            for part in parts[:-1]:
                child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                os.close(fd); fd = child
                self._check(os.fstat(fd), True)
            child = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
            os.close(fd); fd = child
            before = os.fstat(fd)
            self._check(before)
            require(_identity(before) == self.files[path], 'CUSTODY')
            if metadata:
                require(before.st_size <= 1024 * 1024, 'SCHEMA')
            hasher, size, chunks = hashlib.sha256(), 0, []
            while True:
                chunk = os.read(fd, 1024 * 1024)
                if not chunk:
                    break
                hasher.update(chunk); size += len(chunk)
                if metadata:
                    chunks.append(chunk)
            require(_identity(os.fstat(fd)) == _identity(before) and size == before.st_size, 'CUSTODY')
            return size, hasher.hexdigest(), b''.join(chunks) if metadata else None
        except OSError:
            raise GuardError('CUSTODY') from None
        finally:
            os.close(fd)

    def stable(self):
        old_files, old_dirs = self.files, self.directories
        self.files, self.directories = {}, {}
        try:
            self._walk(self.fd, '')
        except OSError:
            raise GuardError('CUSTODY') from None
        require(self.files == old_files and self.directories == old_dirs, 'CUSTODY')

    def close(self):
        if self.fd is not None:
            os.close(self.fd)


def _final_inputs(value):
    object_keys(value, ['schema', 'status', 'task2_inventory_sha256', 'deployment_lock_sha256', 'h2_lock'])
    require(value['schema'] == 'varcamp-final-inputs-v1' and value['status'] == 'verified', 'FINAL_INPUTS')
    sha(value['task2_inventory_sha256']); sha(value['deployment_lock_sha256'])
    lock = value['h2_lock']
    object_keys(lock, ['identityMode', 'image', 'imageId', 'platform', 'archive', 'provenance'], 'H2')
    require(lock['identityMode'] == 'local-artifact-v1' and lock['platform'] == 'linux/arm64', 'H2')
    text(lock['image'], 'H2')
    require('@' not in lock['image'] and ':' in lock['image'], 'H2')
    require(type(lock['imageId']) is str and re.fullmatch('sha256:[0-9a-f]{64}', lock['imageId']), 'H2')
    object_keys(lock['archive'], ['file', 'sha256'], 'H2')
    relative_path(lock['archive']['file']); sha(lock['archive']['sha256'], 'H2')
    p = lock['provenance']
    object_keys(p, ['receiptFile', 'receiptSha256', 'baselineSourceCommit', 'baseImage', 'patchSha256'], 'H2')
    relative_path(p['receiptFile']); sha(p['receiptSha256'], 'H2'); sha(p['patchSha256'], 'H2')
    require(type(p['baselineSourceCommit']) is str and re.fullmatch('[0-9a-f]{40}', p['baselineSourceCommit']), 'H2')
    require(type(p['baseImage']) is str and re.fullmatch('[^\s]+@sha256:[0-9a-f]{64}', p['baseImage']), 'H2')
    require(lock['imageId'] != p['baseImage'].split('@')[1], 'H2')
    return lock


def _signed(value):
    object_keys(value, ['schema', 'status', 'evidence_sha256', 'identity_contract_sha256',
                        'room_namespace_sha256', 'projection_sha256', 'scope'])
    require(value['schema'] == 'varcamp-signed-recovery-v1' and value['status'] == 'verified' and
            value['scope'] == 'reviewed-signed-recovery', 'SIGNED')
    for key in ('evidence_sha256', 'identity_contract_sha256', 'room_namespace_sha256', 'projection_sha256'):
        sha(value[key])
    return contract_hash(value)


def _capture(value, component):
    object_keys(value, ['source_id', 'capture'])
    text(value['source_id'])
    capture = value['capture']
    object_keys(capture, ['start', 'end', 'method', 'consistency', 'boundary_sha256'])
    sha(capture['boundary_sha256'])
    require(capture['method'] == METHODS[component] and
            capture['consistency'] == 'component-consistent', 'CONSISTENCY')
    times = []
    for key in ('start', 'end'):
        require(type(capture[key]) is str and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', capture[key]), 'CONSISTENCY')
        try:
            times.append(datetime.fromisoformat(capture[key].replace('Z', '+00:00')))
        except ValueError:
            raise GuardError('CONSISTENCY') from None
    require(times[0] <= times[1], 'CONSISTENCY')


def _h2(lock, artifacts, receipt):
    p = lock['provenance']
    require(artifacts['h2_archive']['sha256'] == lock['archive']['sha256'] and
            artifacts['h2_patch']['sha256'] == p['patchSha256'] and
            artifacts['h2_provenance']['sha256'] == p['receiptSha256'], 'H2')
    require(type(receipt) is dict, 'H2')
    expected = {'schema': 'local-artifact-v1', 'image': lock['image'], 'imageId': lock['imageId'],
                'platform': lock['platform'], 'baselineSourceCommit': p['baselineSourceCommit'],
                'baseImage': p['baseImage'], 'patchSha256': p['patchSha256']}
    require(all(receipt.get(k) == v for k, v in expected.items()), 'H2')
    require(receipt.get('archive') == lock['archive'] and
            type(receipt.get('patchBytes')) is int and
            receipt['patchBytes'] == artifacts['h2_patch']['size'], 'H2')
    require(receipt.get('exportImport') == {'beforeImageId': lock['imageId'], 'afterImageId': lock['imageId'],
                                          'archiveSha256': lock['archive']['sha256']}, 'H2')


def validate_generation(root, *, owner_uid, owner_gid, expected_generation, final_inputs):
    """Validate complete private bytes; return only explicit safe projections.

    Completion binds exact manifest bytes, not its JSON reserialization. Capture
    semantics are supplied attestations; opaque archives are not parsed here.
    Independent off-host retrieval and actual backup production remain future
    measured outcomes, never inferred from a local hash match.
    """
    text(expected_generation)
    custody = _Custody(root, owner_uid, owner_gid)
    try:
        size, manifest_hash, data = custody.read('manifest.json', True)
        manifest = _json(data)
        _, _, completed_data = custody.read('complete.json', True)
        completed = _json(completed_data)
        object_keys(completed, ['schema', 'generation', 'manifest_sha256', 'manifest_size'])
        require(completed['schema'] == 'varcamp-completion-v1' and
                completed['generation'] == expected_generation and
                type(completed['manifest_size']) is int and completed['manifest_size'] == size and
                completed['manifest_sha256'] == manifest_hash, 'COMPLETION')
        object_keys(manifest, ['schema', 'generation', 'consistency', 'cross_component_atomic',
                               'source_inventory_sha256', 'deployment_lock_sha256', 'signed',
                               'guest_browser_data', 'components', 'artifacts'])
        require(manifest['schema'] == 'varcamp-generation-v1')
        require(manifest['generation'] == expected_generation, 'GENERATION')
        require(manifest['consistency'] == 'component-consistent' and
                manifest['cross_component_atomic'] is False and manifest['guest_browser_data'] == 'excluded', 'CONSISTENCY')
        lock = _final_inputs(final_inputs)
        require(manifest['source_inventory_sha256'] == final_inputs['task2_inventory_sha256'] and
                manifest['deployment_lock_sha256'] == final_inputs['deployment_lock_sha256'], 'FINAL_INPUTS')
        object_keys(manifest['signed'], ['status', 'contract_sha256'])
        signed = manifest['signed']
        require((signed['status'] == 'pending' and signed['contract_sha256'] is None) or
                (signed['status'] == 'verified' and type(signed['contract_sha256']) is str), 'SIGNED')
        if signed['status'] == 'verified':
            sha(signed['contract_sha256'], 'SIGNED')
        object_keys(manifest['components'], ROLES)
        for component, capture in manifest['components'].items():
            _capture(capture, component)
        require(type(manifest['artifacts']) is list and manifest['artifacts'], 'INVENTORY')
        artifacts, names, aliases = {}, set(), set()
        for artifact in manifest['artifacts']:
            object_keys(artifact, ['path', 'component', 'role', 'size', 'sha256'])
            path = relative_path(artifact['path'])
            number(artifact['size'], 1); sha(artifact['sha256'])
            require(artifact['component'] in ROLES and artifact['role'] in ROLES[artifact['component']], 'INVENTORY')
            alias = path.casefold()
            require(path not in names and alias not in aliases and artifact['role'] not in artifacts and
                    path not in ('manifest.json', 'complete.json'), 'INVENTORY')
            names.add(path); aliases.add(alias); artifacts[artifact['role']] = artifact
        require(set(artifacts) == set().union(*ROLES.values()), 'INVENTORY')
        require(names | {'manifest.json', 'complete.json'} <= set(custody.files), 'CUSTODY')
        require(set(custody.files) == names | {'manifest.json', 'complete.json'}, 'INVENTORY')
        expected_dirs = {''}
        for path in names:
            parts = path.split('/')[:-1]
            for i in range(1, len(parts)+1):
                expected_dirs.add('/'.join(parts[:i]) + '/')
        require(set(custody.directories) == expected_dirs, 'INVENTORY')
        provenance = None
        for role, artifact in artifacts.items():
            n, h, body = custody.read(artifact['path'], role == 'h2_provenance')
            require(n == artifact['size'] and h == artifact['sha256'], 'ARTIFACT')
            if role == 'h2_provenance':
                provenance = _json(body)
        require(artifacts['deployment_lock']['sha256'] == final_inputs['deployment_lock_sha256'], 'FINAL_INPUTS')
        _h2(lock, artifacts, provenance)
        custody.stable()
        return {'status': 'validated-private-generation', 'generation': expected_generation,
                'manifest_sha256': manifest_hash, 'manifest_size': size, 'artifact_count': len(artifacts),
                'artifacts': [{'name': a['path'], 'sha256': a['sha256'], 'size': a['size']} for a in artifacts.values()],
                'signed_status': signed['status'], 'signed_contract_sha256': signed['contract_sha256'],
                'actual_capture': False, 'offhost_retrieval_verified': False}
    finally:
        custody.close()


def _resource_records(value, code):
    records, ids, names, paths, identities = [], set(), set(), [], set()
    for group in RESOURCE_KINDS:
        require(type(value[group]) is list, code)
        for r in value[group]:
            common = {'kind', 'name', 'id', 'owner', 'project'}
            extra = {'volumes': {'mountpoint', 'canonical_path', 'fs_identity', 'attachments', 'empty'},
                     'binds': {'path', 'canonical_path', 'fs_identity', 'symlink', 'attachments', 'empty'},
                     'networks': {'driver', 'subnet', 'gateway', 'attachments'},
                     'services': {'service', 'image_id', 'mounts', 'networks', 'network_mode', 'privileged', 'listeners'}}[group]
            object_keys(r, common | extra, code)
            require(r['kind'] == {'volumes':'volume','binds':'bind','networks':'network','services':'service'}[group], code)
            for k in common - {'kind'}:
                text(r[k], code)
            require(r['id'] not in ids and r['name'] not in names, code)
            ids.add(r['id']); names.add(r['name'])
            if group in ('volumes', 'binds'):
                absolute_path(r['canonical_path'], code)
                absolute_path(r['mountpoint' if group == 'volumes' else 'path'], code)
                fi = r['fs_identity']
                require(type(fi) is list and len(fi) == 2 and all(type(n) is int and n >= 0 for n in fi), code)
                require(tuple(fi) not in identities and r['canonical_path'] not in paths, code)
                identities.add(tuple(fi)); paths.append(r['canonical_path'])
                require(type(r['empty']) is bool, code)
                if group == 'binds':
                    require(type(r['symlink']) is bool, code)
            if group != 'services':
                require(type(r['attachments']) is list and all(type(i) is str and i for i in r['attachments']) and
                        len(set(r['attachments'])) == len(r['attachments']), code)
            if group == 'networks':
                require(r['driver'] == 'bridge', code)
                try:
                    net = ipaddress.ip_network(r['subnet'], strict=True)
                    gateway = ipaddress.ip_address(r['gateway'])
                    require(net.version == 4 and gateway in net and gateway not in (net.network_address, net.broadcast_address), code)
                except (ValueError, TypeError):
                    raise GuardError(code) from None
            if group == 'services':
                require(type(r['image_id']) is str and re.fullmatch('sha256:[0-9a-f]{64}', r['image_id']) and
                        r['network_mode'] == 'bridge' and r['privileged'] is False, code)
                text(r['service'], code)
                require(type(r['mounts']) is list and type(r['networks']) is list and type(r['listeners']) is list, code)
                require(len(set(r['networks'])) == len(r['networks']) and all(type(n) is str and n for n in r['networks']), code)
                mount_targets = set()
                for mount in r['mounts']:
                    object_keys(mount, ['kind', 'id', 'target'], code)
                    require(mount['kind'] in ('volume', 'bind'), code); text(mount['id'], code)
                    absolute_path(mount['target'], code)
                    require(mount['target'] not in mount_targets, code); mount_targets.add(mount['target'])
            records.append(r)
    return records


def _baseline(value):
    object_keys(value, ['schema', 'projects', *RESOURCE_KINDS, 'issuers', 'client_routes'], 'BASELINE')
    require(value['schema'] == 'varcamp-production-baseline-v1', 'BASELINE')
    for key in ('projects', 'issuers', 'client_routes'):
        require(type(value[key]) is list and value[key] and all(type(x) is str and x for x in value[key]) and
                len(set(value[key])) == len(value[key]), 'BASELINE')
    require('varcamp' in value['projects'] and value['volumes'] and value['binds'] and value['networks'], 'BASELINE')
    return _resource_records(value, 'BASELINE')


def _isolation(value, baseline, code='ISOLATION', fresh=True):
    project, owner = value['project'], value['owner']
    require(type(project) is str and re.fullmatch('varcamp_restore_[a-z0-9_]+', project) and
            project not in baseline['projects'], code)
    text(owner, code)
    require(owner not in {r['owner'] for k in RESOURCE_KINDS for r in baseline[k]}, code)
    records = _resource_records(value, code)
    other = [r for k in RESOURCE_KINDS for r in baseline[k]]
    other_ids = {r['id'] for r in other}; other_names = {r['name'] for r in other}
    other_paths = [r['canonical_path'] for r in other if 'canonical_path' in r]
    other_fi = {tuple(r['fs_identity']) for r in other if 'fs_identity' in r}
    require(value['volumes'] and value['binds'] and len(value['networks']) == 1, code)
    for r in records:
        require(r['project'] == project and r['owner'] == owner and r['name'].startswith(project + '_') and
                r['id'] not in other_ids and r['name'] not in other_names, code)
        if 'canonical_path' in r:
            path = r['canonical_path']
            require(tuple(r['fs_identity']) not in other_fi and all(
                path != p and not path.startswith(p + '/') and not p.startswith(path + '/') for p in other_paths), code)
            require(r['mountpoint' if r['kind']=='volume' else 'path'] == path, code)
            if r['kind'] == 'bind':
                require(path.startswith('/srv/varcamp-recovery/' + project + '/') and r['symlink'] is False, code)
            if fresh:
                require(r['empty'] is True, code)
        if r['kind'] == 'network':
            net = ipaddress.ip_network(r['subnet'])
            require(all(not net.overlaps(ipaddress.ip_network(n['subnet'])) for n in baseline['networks']), code)
        if fresh and 'attachments' in r:
            require(r['attachments'] == [], code)
    own_ids = {r['id']:r for r in records}
    for service in value['services']:
        require(all(n in own_ids and own_ids[n]['kind']=='network' for n in service['networks']), code)
        require(all(m['id'] in own_ids and own_ids[m['id']]['kind']==m['kind'] for m in service['mounts']), code)
        require(all(type(p) is dict and p in _listeners() for p in service['listeners']), code)
    # ACME never becomes a mounted clone target; the only required durable roles.
    require({r['name'] for r in value['volumes']} == {project+'_'+n for n in ('maps','postgres','redis')} and
            {r['name'] for r in value['binds']} == {project+'_'+n for n in ('private','static_tls')} and
            value['networks'][0]['name'] == project+'_core', code)
    return records


def _listeners():
    return [{'ip':'127.0.0.1','port':p,'protocol':'tcp','tls':True,'service':n} for n,p in PORTS.items()]


def _endpoints(desired):
    from urllib.parse import urlsplit
    origins = {n:'https://' + HOST + ':' + str(p) for n,p in PORTS.items()}
    require(desired['origins'] == origins and desired['issuer'] == origins['idp']+'/realms/varcamp' and
            desired['callback'] == origins['play']+'/openid-callback', 'ENDPOINTS')
    require(desired['client_routes'] == [origins['play'], origins['play']+'/openid-callback', origins['play']+'/logout-callback'], 'ENDPOINTS')
    require(type(desired['endpoint_refs']) is list and desired['endpoint_refs'], 'ENDPOINTS')
    for endpoint in desired['endpoint_refs']:
        text(endpoint, 'ENDPOINTS')
        try:
            u = urlsplit(endpoint)
            require(u.scheme in ('https','wss') and u.hostname == HOST and u.port in PORTS.values() and
                    u.netloc == HOST+':'+str(u.port) and not u.username and not u.password and not u.fragment, 'ENDPOINTS')
        except ValueError:
            raise GuardError('ENDPOINTS') from None
    require(desired['tls'] == {'mode':'static-matching-trusted','custody':'separate-private',
                               'validation':'normal-ca-hostname','hostname':HOST}, 'ENDPOINTS')
    require(desired['server_resolution'] == {'hostname':HOST,'network_id':desired['networks'][0]['id'],
                                            'scope':'clone-only'}, 'ENDPOINTS')
    relay = desired['relay']
    object_keys(relay, ['bind_ip','port','routes','public_fallback'], 'ENDPOINTS')
    require(relay['bind_ip']=='127.0.0.1' and type(relay['port']) is int and
            1024 <= relay['port'] <= 65535 and relay['port'] not in PORTS.values() and
            relay['public_fallback'] is False, 'ENDPOINTS')
    require(relay['routes'] == [{'authority':HOST+':'+str(p),'forward_ip':'127.0.0.1','forward_port':p,
                                 'remote_ip':'127.0.0.1','remote_port':p} for p in PORTS.values()] and
            all(type(r['forward_port']) is int and type(r['remote_port']) is int for r in relay['routes']), 'ENDPOINTS')


def validate_restore_target(desired, actual, baseline, *, final_inputs, signed_contract):
    """Require exact owned, fresh safe metadata. No transport or writes."""
    _final_inputs(final_inputs)
    signed_hash = _signed(signed_contract)
    _baseline(baseline)
    object_keys(desired, ['schema','project','owner','source_inventory_sha256','signed_contract_sha256',
                          *RESOURCE_KINDS,'options','listeners','origins','issuer','callback','client_routes',
                          'endpoint_refs','server_resolution','tls','relay'])
    require(desired['schema']=='varcamp-isolated-target-v1')
    require(desired['source_inventory_sha256']==final_inputs['task2_inventory_sha256'], 'FINAL_INPUTS')
    require(desired['signed_contract_sha256']==signed_hash, 'SIGNED')
    records = _isolation(desired, baseline)
    require(desired['options'] == {'host_network':False,'privileged':False,'acme_provider':False,
                                   'global_changes':False,'bootstrap_import':False} and
            all(v is False for v in desired['options'].values()), 'ISOLATION')
    require(desired['listeners']==_listeners() and all(type(p['port']) is int and p['tls'] is True
                                                      for p in desired['listeners']), 'LISTENERS')
    _endpoints(desired)
    require(desired['issuer'] not in baseline['issuers'] and
            not set(desired['client_routes']) & set(baseline['client_routes']), 'ENDPOINTS')
    object_keys(actual, ['schema','project','owner',*RESOURCE_KINDS,'available_listeners'], 'ACTUAL')
    require(actual['schema']=='varcamp-target-inventory-v1' and actual['project']==desired['project'] and
            actual['owner']==desired['owner'], 'ACTUAL')
    _resource_records(actual, 'ACTUAL')
    require(actual['services']==[], 'ACTUAL')
    for group in ('volumes','binds','networks'):
        require(sorted(actual[group],key=lambda r:r['id'])==sorted(desired[group],key=lambda r:r['id']), 'ACTUAL')
    require(actual['available_listeners']==desired['listeners'], 'ACTUAL')
    return {'status':'validated-fresh-isolated-target','project':desired['project'],
            'resource_count':len(records),'signed_contract_sha256':signed_hash,'actual_restore':False,
            'runtime_endpoint_closure_verified':False,'trusted_tls_verified':False}


def validate_restore_plan(root, *, owner_uid, owner_gid, expected_generation, final_inputs,
                          signed_contract, desired, actual, baseline):
    """Generation-first composition: no target data is processed on rejection."""
    generation = validate_generation(root, owner_uid=owner_uid, owner_gid=owner_gid,
                                     expected_generation=expected_generation, final_inputs=final_inputs)
    target = validate_restore_target(desired, actual, baseline, final_inputs=final_inputs, signed_contract=signed_contract)
    require(generation['signed_status']=='verified' and
            generation['signed_contract_sha256']==target['signed_contract_sha256'], 'SIGNED')
    return {'status':'validated-local-plan','generation':generation,'target':target,
            'actual_restore':False,'signed_ui_accepted':False}


def validate_cleanup_eligibility(expected, actual, owned_ids, baseline):
    """Exact full-contract eligibility only. Never discovers or deletes IDs."""
    try:
        _baseline(baseline)
        object_keys(expected, ['schema','project','owner',*RESOURCE_KINDS])
        object_keys(actual, ['schema','project','owner',*RESOURCE_KINDS])
        require(expected['schema']=='varcamp-cleanup-contract-v1' and actual['schema']=='varcamp-cleanup-inventory-v1')
        records = _isolation(expected,baseline, fresh=False)
        _isolation(actual,baseline, fresh=False)
        require(actual['project']==expected['project'] and actual['owner']==expected['owner'])
        for group in RESOURCE_KINDS:
            require(sorted(expected[group],key=lambda r:r['id'])==sorted(actual[group],key=lambda r:r['id']))
        require(type(owned_ids) is list and owned_ids and all(type(i) is str and i for i in owned_ids) and
                len(set(owned_ids))==len(owned_ids) and set(owned_ids)=={r['id'] for r in records})
        ids=set(owned_ids)
        require(all(set(r.get('attachments',[])) <= ids for r in records))
        return {'status':'eligible-exact-owned-ids','ids':sorted(ids),'resource_count':len(ids),'cleanup_executed':False}
    except GuardError:
        raise GuardError('CLEANUP') from None
