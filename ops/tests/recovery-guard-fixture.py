"""Inert synthetic fixtures. No real image, SQL, Redis, TLS or identity data."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

GUARD = Path(__file__).resolve().parents[1] / 'recovery_guard.py'
H = 'varcamp.3-1-133-135.sslip.io'
PROJECT = 'varcamp_restore_synthetic'
D = lambda b: hashlib.sha256(b).hexdigest()
SHA = 'a' * 64
ROLES = {
    'maps': ['maps_archive', 'maps_inventory', 'native_metadata'],
    'postgres': ['postgres_archive', 'postgres_prerequisites'],
    'redis': ['redis_rdb', 'redis_policy'],
    'deployment': ['deployment_config', 'deployment_lock'],
    'h2': ['h2_archive', 'h2_patch', 'h2_provenance'],
    'acme': ['acme_offline'],
}
METHODS = {'maps': 'coordinated-readonly-tree', 'postgres': 'pg_dump-custom-17.6',
           'redis': 'completed-rdb', 'deployment': 'frozen-final-config',
           'h2': 'verified-local-artifact', 'acme': 'coordinated-offline-copy'}


def put(path, data):
    path.write_bytes(data)
    path.chmod(0o600)


def packed(value):
    return (json.dumps(value, sort_keys=True) + '\n').encode()


def setup(root):
    root.chmod(0o700)
    (root / 'opaque').mkdir(mode=0o700)
    archive, patch = b'synthetic opaque H2 archive', b'synthetic opaque source patch'
    h2 = {'schema': 'local-artifact-v1', 'image': 'synthetic/h2:local',
          'imageId': 'sha256:' + 'b' * 64, 'platform': 'linux/arm64',
          'archive': {'file': 'synthetic-source/image.tar', 'sha256': D(archive)},
          'baselineSourceCommit': 'c' * 40,
          'baseImage': 'synthetic/base@sha256:' + 'd' * 64,
          'patchSha256': D(patch), 'patchBytes': len(patch),
          'exportImport': {'beforeImageId': 'sha256:' + 'b' * 64,
                           'afterImageId': 'sha256:' + 'b' * 64,
                           'archiveSha256': D(archive)}}
    h2bytes = packed(h2)
    lock = {'identityMode': 'local-artifact-v1', 'image': h2['image'],
            'imageId': h2['imageId'], 'platform': h2['platform'],
            'archive': h2['archive'],
            'provenance': {'receiptFile': 'synthetic-source/provenance.json',
                           'receiptSha256': D(h2bytes),
                           'baselineSourceCommit': h2['baselineSourceCommit'],
                           'baseImage': h2['baseImage'], 'patchSha256': D(patch)}}
    final = {'schema': 'varcamp-final-inputs-v1', 'status': 'verified',
             'task2_inventory_sha256': SHA, 'deployment_lock_sha256': D(b'synthetic deployment lock'),
             'h2_lock': lock}
    signed = {'schema': 'varcamp-signed-recovery-v1', 'status': 'verified',
              'evidence_sha256': 'e' * 64, 'identity_contract_sha256': 'f' * 64,
              'room_namespace_sha256': '1' * 64, 'projection_sha256': '2' * 64,
              'scope': 'reviewed-signed-recovery'}
    artifacts = []
    for component, roles in ROLES.items():
        for role in roles:
            data = {'h2_archive': archive, 'h2_patch': patch, 'h2_provenance': h2bytes,
                    'deployment_lock': b'synthetic deployment lock'}.get(role, ('opaque synthetic ' + role).encode())
            name = 'opaque/' + role + '.bin'
            put(root / name, data)
            artifacts.append({'path': name, 'role': role, 'component': component,
                              'size': len(data), 'sha256': D(data)})
    manifest = {'schema': 'varcamp-generation-v1', 'generation': 'synthetic-generation-001',
                'consistency': 'component-consistent', 'cross_component_atomic': False,
                'source_inventory_sha256': SHA, 'deployment_lock_sha256': final['deployment_lock_sha256'],
                'signed': {'status': 'verified', 'contract_sha256': D(packed(signed))},
                'guest_browser_data': 'excluded',
                'components': {k: {'source_id': 'synthetic-source-' + k,
                                  'capture': {'start': '2026-10-11T00:00:00Z',
                                              'end': '2026-10-11T00:00:01Z',
                                              'method': METHODS[k], 'consistency': 'component-consistent',
                                              'boundary_sha256': SHA}} for k in ROLES},
                'artifacts': artifacts}
    seal(root, manifest)
    owner = 'synthetic-recovery-owner'
    def common(kind, name, ident):
        return {'kind': kind, 'name': PROJECT + '_' + name, 'id': ident,
                'owner': owner, 'project': PROJECT}
    volumes = [{**common('volume', n, 'synthetic-volume-' + n), 'mountpoint': '/synthetic/docker/' + n,
                'canonical_path': '/synthetic/docker/' + n, 'fs_identity': [9, i],
                'attachments': [], 'empty': True} for i, n in enumerate(['maps', 'postgres', 'redis'], 1)]
    binds = [{**common('bind', n, 'synthetic-bind-' + n),
              'path': '/srv/varcamp-recovery/' + PROJECT + '/' + n,
              'canonical_path': '/srv/varcamp-recovery/' + PROJECT + '/' + n,
              'fs_identity': [8, i], 'symlink': False, 'attachments': [], 'empty': True}
             for i, n in enumerate(['private', 'static_tls'], 1)]
    network = {**common('network', 'core', 'synthetic-network-core'),
               'driver': 'bridge', 'subnet': '10.204.2.0/24', 'gateway': '10.204.2.1', 'attachments': []}
    origins = {n: 'https://' + H + ':' + str(p) for n, p in
               [('play', 18443), ('idp', 18444), ('maps', 18445), ('icons', 18446)]}
    desired = {'schema': 'varcamp-isolated-target-v1', 'project': PROJECT, 'owner': owner,
               'source_inventory_sha256': SHA, 'signed_contract_sha256': D(packed(signed)),
               'volumes': volumes, 'binds': binds, 'networks': [network], 'services': [],
               'options': {'host_network': False, 'privileged': False, 'acme_provider': False,
                           'global_changes': False, 'bootstrap_import': False},
               'listeners': [{'ip': '127.0.0.1', 'port': p, 'protocol': 'tcp', 'tls': True, 'service': n}
                             for n, p in [('play', 18443), ('idp', 18444), ('maps', 18445), ('icons', 18446)]],
               'origins': origins, 'issuer': origins['idp'] + '/realms/varcamp',
               'callback': origins['play'] + '/openid-callback',
               'client_routes': [origins['play'], origins['play'] + '/openid-callback',
                                 origins['play'] + '/logout-callback'],
               'endpoint_refs': [origins['play'] + '/~/synthetic/a.wam', origins['maps'] + '/synthetic/a.wam',
                                 'wss://' + H + ':18443/room'],
               'server_resolution': {'hostname': H, 'network_id': network['id'], 'scope': 'clone-only'},
               'tls': {'mode': 'static-matching-trusted', 'custody': 'separate-private',
                       'validation': 'normal-ca-hostname', 'hostname': H},
               'relay': {'bind_ip': '127.0.0.1', 'port': 19443,
                         'routes': [{'authority': H + ':' + str(p), 'forward_ip': '127.0.0.1',
                                     'forward_port': p, 'remote_ip': '127.0.0.1', 'remote_port': p}
                                    for p in range(18443, 18447)], 'public_fallback': False}}
    actual = {'schema': 'varcamp-target-inventory-v1', 'project': PROJECT, 'owner': owner,
              'volumes': copy.deepcopy(volumes), 'binds': copy.deepcopy(binds),
              'networks': [copy.deepcopy(network)], 'services': [],
              'available_listeners': copy.deepcopy(desired['listeners'])}
    production = {'schema': 'varcamp-production-baseline-v1', 'projects': ['varcamp', 'unrelated'],
                  'volumes': [{**common('volume', 'prod', 'production-volume-id'), 'name': 'varcamp_maps',
                               'project': 'varcamp', 'owner': 'synthetic-production-owner', 'mountpoint': '/synthetic/prod/maps',
                               'canonical_path': '/synthetic/prod/maps', 'fs_identity': [7, 1],
                               'attachments': ['production-service-id'], 'empty': False}],
                  'binds': [{**common('bind', 'prod', 'production-bind-id'), 'name': 'production-private',
                             'project': 'varcamp', 'owner': 'synthetic-production-owner', 'path': '/srv/varcamp/private',
                             'canonical_path': '/srv/varcamp/private', 'fs_identity': [7, 2],
                             'symlink': False, 'attachments': ['production-service-id'], 'empty': False}],
                  'networks': [{**network, 'id': 'production-network-id', 'name': 'varcamp_core',
                                'project': 'varcamp', 'owner': 'synthetic-production-owner', 'subnet': '10.203.1.0/24', 'gateway': '10.203.1.1',
                                'attachments': ['production-service-id']}], 'services': [],
                  'issuers': ['https://' + H + '/realms/varcamp'], 'client_routes': ['https://' + H]}
    return manifest, final, signed, desired, actual, production


def seal(root, manifest):
    data = packed(manifest)
    put(root / 'manifest.json', data)
    put(root / 'complete.json', packed({'schema': 'varcamp-completion-v1',
                                      'generation': manifest['generation'], 'manifest_sha256': D(data),
                                      'manifest_size': len(data)}))


def plan(api, root, values):
    manifest, final, signed, desired, actual, production = values
    return api.validate_restore_plan(root, owner_uid=os.getuid(), owner_gid=os.getgid(),
                                     expected_generation='synthetic-generation-001', final_inputs=final,
                                     signed_contract=signed, desired=desired, actual=actual, baseline=production)


def run(api, group):
    cases = 0
    def scenario(change=None, error=None, action=None):
        nonlocal cases
        with tempfile.TemporaryDirectory(prefix='synthetic-recovery-') as tmp:
            root = Path(tmp).resolve()
            values = setup(root)
            if change:
                change(root, values)
            spy = root.parent / (root.name + '-target-spy')
            try:
                result = action(root, values) if action else plan(api, root, values)
                if error:
                    raise AssertionError('guard accepted rejected scenario ' + error)
                if action is None:
                    assert result['status'] == 'validated-local-plan'
                    assert result['actual_restore'] is False
                    assert result['signed_ui_accepted'] is False
                    # Caller would only write after the complete real guard returns.
                    put(spy, b'synthetic target write')
                    assert spy.read_bytes() == b'synthetic target write'
            except api.GuardError as exc:
                if error is None:
                    raise
                assert exc.code == error, (exc.code, error)
                assert not spy.exists(), 'rejection occurred after target write'
                assert 'opaque synthetic' not in str(exc)
            finally:
                if spy.exists():
                    spy.unlink()
            cases += 1

    if group == 'positive':
        scenario()
        scenario(lambda r,v:(v[0]['signed'].update(status='pending',contract_sha256=None),seal(r,v[0])),
                 action=lambda root, v: api.validate_generation(root, owner_uid=os.getuid(), owner_gid=os.getgid(),
                  expected_generation=v[0]['generation'], final_inputs=v[1]))
        scenario(lambda r, v: (v[0]['signed'].update(status='verified', contract_sha256=D(packed(v[2]))), seal(r, v[0])))
    elif group == 'custody':
        for name in ['manifest.json', 'complete.json', 'opaque/maps_archive.bin']:
            scenario(lambda r, v, n=name: (r/n).unlink(), 'CUSTODY')
            scenario(lambda r, v, n=name: (r/n).chmod(0o644), 'CUSTODY')
            scenario(lambda r, v, n=name: ((r/n).unlink(), (r/n).symlink_to(r/'opaque/redis_rdb.bin')), 'CUSTODY')
            scenario(lambda r, v, n=name: ((r/n).unlink(), (r/n).mkdir(mode=0o700)), 'CUSTODY')
        scenario(lambda r, v: r.chmod(0o755), 'CUSTODY')
        scenario(lambda r, v: (r/'opaque').chmod(0o755), 'CUSTODY')
        scenario(lambda r, v: os.link(r/'opaque/maps_archive.bin', r/'opaque/hardlink'), 'CUSTODY')
        scenario(lambda r, v: put(r/'opaque/unexpected', b'opaque synthetic extra'), 'INVENTORY')
        scenario(action=lambda r, v: api.validate_generation(r, owner_uid=os.getuid()+1, owner_gid=os.getgid(),
                 expected_generation=v[0]['generation'], final_inputs=v[1]), error='CUSTODY')
        scenario(action=lambda r, v: api.validate_generation(r, owner_uid=True, owner_gid=os.getgid(),
                 expected_generation=v[0]['generation'], final_inputs=v[1]), error='SCHEMA')
        scenario(lambda r, v: put(r/'opaque/redis_rdb.bin', b'torn opaque bytes'), 'ARTIFACT')
        scenario(lambda r, v: put(r/'complete.json', b'{'), 'SCHEMA')
        scenario(lambda r, v: put(r/'manifest.json', b'{}'), 'COMPLETION')
        scenario(lambda r, v: put(r/'complete.json', packed({'schema':'varcamp-completion-v1', 'generation':v[0]['generation'],
                                                         'manifest_sha256':SHA, 'manifest_size':1})), 'COMPLETION')
    elif group == 'manifest':
        def mutate(fn):
            return lambda r, v: (fn(v), seal(r, v[0]))
        for path in ['/absolute.bin', '../escape', 'opaque/../maps_archive.bin', 'opaque//maps_archive.bin',
                     'opaque/./maps_archive.bin', 'opaque\\maps_archive.bin']:
            scenario(mutate(lambda v, p=path: v[0]['artifacts'][0].update(path=p)), 'PATH')
        for fn, code in [
            (lambda v: v[0].update(schema='future-v2'), 'SCHEMA'),
            (lambda v: v[0].update(generation='other-generation'), 'COMPLETION'),
            (lambda v: v[0].update(cross_component_atomic=True), 'CONSISTENCY'),
            (lambda v: v[0]['components']['postgres']['capture'].update(method='online-data-directory'), 'CONSISTENCY'),
            (lambda v: v[0]['components']['redis']['capture'].update(end='2026-10-10T23:59:00Z'), 'CONSISTENCY'),
            (lambda v: v[0]['components']['redis']['capture'].update(boundary_sha256=''), 'SCHEMA'),
            (lambda v: v[0]['artifacts'][0].update(size=True), 'SCHEMA'),
            (lambda v: v[0]['artifacts'][0].update(size=0), 'SCHEMA'),
            (lambda v: v[0]['artifacts'][0].update(sha256='BAD'), 'SCHEMA'),
            (lambda v: v[0]['artifacts'].append(copy.deepcopy(v[0]['artifacts'][0])), 'INVENTORY'),
            (lambda v: v[0]['artifacts'].pop(), 'INVENTORY'),
            (lambda v: v[0]['signed'].update(status='accepted-ui'), 'SIGNED'),
            (lambda v: v[0].update(source_inventory_sha256='b'*64), 'FINAL_INPUTS'),
            (lambda v: v[1].update(status='pending'), 'FINAL_INPUTS'),
            (lambda v: v[1]['h2_lock'].update(identityMode='registry-digest'), 'H2'),
            (lambda v: v[1]['h2_lock'].update(imageId='sha256:'+'9'*64), 'H2'),
            (lambda v: v[1]['h2_lock']['provenance'].update(patchSha256='9'*64), 'H2'),
            (lambda v: v[1]['h2_lock']['provenance'].update(receiptSha256='9'*64), 'H2'),
        ]:
            scenario(mutate(fn), code)
        def rewrite_h2(r, v):
            path=r/'opaque/h2_provenance.bin'; receipt=json.loads(path.read_bytes())
            receipt['exportImport']['afterImageId']='sha256:'+'9'*64
            data=packed(receipt); put(path,data)
            next(a for a in v[0]['artifacts'] if a['role']=='h2_provenance').update(size=len(data),sha256=D(data))
            v[1]['h2_lock']['provenance']['receiptSha256']=D(data);seal(r,v[0])
        scenario(rewrite_h2, 'H2')
        scenario(lambda r,v: put(r/'manifest.json', b'{"schema":"varcamp-generation-v1","schema":"future-v2"}'), 'SCHEMA')
    elif group == 'target':
        # These failures must occur despite a valid, complete private generation.
        for fn, code in [
            (lambda v: v[1].update(status='pending'), 'FINAL_INPUTS'),
            (lambda v: v[2].update(status='pending'), 'SIGNED'),
            (lambda v: v[2].pop('projection_sha256'), 'SCHEMA'),
            (lambda v: v[3].update(project='varcamp'), 'ISOLATION'),
            (lambda v: v[3]['volumes'][0].update(id='production-volume-id', name=PROJECT+'_changed'), 'ISOLATION'),
            (lambda v: v[3]['volumes'][0].update(canonical_path='/synthetic/prod/maps'), 'ISOLATION'),
            (lambda v: v[3]['binds'][0].update(fs_identity=[7,2]), 'ISOLATION'),
            (lambda v: v[3]['binds'][0].update(path='/srv/varcamp/private/alias'), 'ISOLATION'),
            (lambda v: v[3]['binds'][0].update(symlink=True), 'ISOLATION'),
            (lambda v: v[3]['networks'][0].update(subnet='10.203.1.0/25', gateway='10.203.1.2'), 'ISOLATION'),
            (lambda v: v[3]['networks'][0].update(gateway='10.204.3.1'), 'ISOLATION'),
            (lambda v: v[3]['networks'][0].update(subnet='10.204.2.4/24'), 'ISOLATION'),
            (lambda v: v[3]['listeners'][0].update(ip='0.0.0.0'), 'LISTENERS'),
            (lambda v: v[3]['listeners'][0].update(port=443), 'LISTENERS'),
            (lambda v: v[3]['listeners'][0].update(port=True), 'LISTENERS'),
            (lambda v: v[3]['listeners'][0].update(tls=False), 'LISTENERS'),
            (lambda v: v[3]['options'].update(host_network=True), 'ISOLATION'),
            (lambda v: v[3]['options'].update(privileged=True), 'ISOLATION'),
            (lambda v: v[3]['options'].update(acme_provider=True), 'ISOLATION'),
            (lambda v: v[3]['options'].update(global_changes=True), 'ISOLATION'),
            (lambda v: v[3]['options'].update(bootstrap_import=True), 'ISOLATION'),
            (lambda v: v[3]['endpoint_refs'].append('https://'+H+'/prod'), 'ENDPOINTS'),
            (lambda v: v[3]['endpoint_refs'].append('https://foreign.example:18443'), 'ENDPOINTS'),
            (lambda v: v[3]['endpoint_refs'].append('https://user:secret@'+H+':18443'), 'ENDPOINTS'),
            (lambda v: v[3].update(issuer='https://'+H+'/realms/varcamp'), 'ENDPOINTS'),
            (lambda v: v[3]['client_routes'].append('https://'+H), 'ENDPOINTS'),
            (lambda v: v[3]['tls'].update(validation='ignoreHTTPS'), 'ENDPOINTS'),
            (lambda v: v[3]['relay'].update(public_fallback=True), 'ENDPOINTS'),
            (lambda v: v[3]['relay']['routes'][0].update(remote_ip='3.1.133.135'), 'ENDPOINTS'),
            (lambda v: v[3]['relay']['routes'][0].update(authority=H+':443'), 'ENDPOINTS'),
            (lambda v: v[3]['volumes'].append(copy.deepcopy(v[3]['volumes'][0])), 'ISOLATION'),
            (lambda v: v[4]['volumes'][0].update(id='stale-resource-id'), 'ACTUAL'),
            (lambda v: v[4]['volumes'][0].update(empty=False), 'ACTUAL'),
            (lambda v: v[4]['volumes'][0].update(attachments=['other-container']), 'ACTUAL'),
            (lambda v: v[4]['binds'][0].update(fs_identity=[8,99]), 'ACTUAL'),
            (lambda v: v[4]['networks'][0].update(owner='unrelated-owner'), 'ACTUAL'),
            (lambda v: v[4]['networks'].append(copy.deepcopy(v[4]['networks'][0])), 'ACTUAL'),
            (lambda v: v[4]['available_listeners'].pop(), 'ACTUAL'),
            (lambda v: v[3].update(signed_contract_sha256='9'*64), 'SIGNED'),
            (lambda v: v[5]['volumes'].append(copy.deepcopy(v[5]['volumes'][0])), 'BASELINE'),
        ]:
            scenario(lambda r,v,f=fn:f(v), code)
    elif group == 'cleanup':
        def cleanup(r,v):
            expected={k:copy.deepcopy(v[3][k]) for k in ['project','owner','volumes','binds','networks','services']}
            expected['schema']='varcamp-cleanup-contract-v1'
            actual={k:copy.deepcopy(expected[k]) for k in ['project','owner','volumes','binds','networks','services']}
            actual['schema']='varcamp-cleanup-inventory-v1'
            return expected,actual,[x['id'] for k in ['volumes','binds','networks','services'] for x in expected[k]]
        def perform(r,v,fn=None):
            e,a,ids=cleanup(r,v)
            if fn:fn(e,a,ids)
            return api.validate_cleanup_eligibility(e,a,ids,v[5])
        scenario(action=lambda r,v:perform(r,v))
        for fn in [lambda e,a,i:i.append('production-volume-id'), lambda e,a,i:i.append(i[0]),
                   lambda e,a,i:a['volumes'][0].update(id='stale-resource-id'),
                   lambda e,a,i:a['volumes'][0].update(owner='foreign-owner'),
                   lambda e,a,i:a['volumes'][0].update(canonical_path='/synthetic/prod/maps'),
                   lambda e,a,i:a['networks'][0].update(subnet='10.203.1.0/24'),
                   lambda e,a,i:a['binds'][0].update(fs_identity=[7,2]),
                   lambda e,a,i:a['services'].append({'id':'foreign'}),
                   lambda e,a,i:e.update(project='varcamp')]:
            scenario(action=lambda r,v,f=fn:perform(r,v,f),error='CLEANUP')
        # Full service image/mount/network contract must match, not labels alone.
        service={'kind':'service','id':'synthetic-container-id','name':PROJECT+'_play',
                 'owner':'synthetic-recovery-owner','project':PROJECT,'service':'play','image_id':'sha256:'+'b'*64,
                 'mounts':[{'kind':'volume','id':'synthetic-volume-maps','target':'/maps'}],
                 'networks':['synthetic-network-core'],'network_mode':'bridge','privileged':False,
                 'listeners':[]}
        def with_service(r,v,mutation=None):
            e,a,ids=cleanup(r,v); e['services']=[copy.deepcopy(service)];a['services']=[copy.deepcopy(service)]
            ids.append(service['id'])
            if mutation:mutation(a['services'][0])
            return api.validate_cleanup_eligibility(e,a,ids,v[5])
        scenario(action=lambda r,v:with_service(r,v))
        for mutation in [lambda s:s.update(image_id='sha256:'+'9'*64),lambda s:s.update(service='other'),
                         lambda s:s['mounts'][0].update(id='production-volume-id'),
                         lambda s:s['networks'].append('production-network-id')]:
            scenario(action=lambda r,v,f=mutation:with_service(r,v,f),error='CLEANUP')
    elif group == 'inert':
        p=subprocess.run([sys.executable,str(GUARD)],capture_output=True,text=True)
        assert p.returncode==0 and p.stdout=='' and p.stderr==''
        cases=1
    else:
        raise AssertionError('unknown fixture group')
    return cases


if __name__ == '__main__':
    if not GUARD.exists():
        print(json.dumps({'available':False,'passed':False,'cases':0,'reason':'guard foundation absent'}))
    else:
        spec=importlib.util.spec_from_file_location('recovery_guard',GUARD)
        api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
        print(json.dumps({'available':True,'passed':True,'cases':run(api,sys.argv[1])}))
