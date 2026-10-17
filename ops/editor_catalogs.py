"""Explicit collection-registration intent; never replace organizer WAM content."""
import argparse
import hashlib
import json
import pathlib
import re
import urllib.parse
from release_upload import Storage, read_zip, zip_bytes, inventory, apply_plan

def require(value, message):
    if not value:
        raise ValueError(message)

def strict_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'Duplicate JSON key')
            result[key] = value
        return result
    def constant(value):
        raise ValueError('Non-JSON constant')
    return json.loads(text, object_pairs_hook=pairs, parse_constant=constant)

def validate_catalogs(required):
    require(type(required) is list and bool(required), 'Explicit catalogs required')
    urls = set()
    for item in required:
        require(type(item) is dict and set(item) == {'url', 'type'} and item['type'] == 'file' and type(item['url']) is str, 'Native file descriptor required')
        url = urllib.parse.urlsplit(item['url'])
        require(url.scheme == 'https' and bool(url.hostname) and not url.username and not url.password and not url.fragment and not url.query, 'Plain trusted HTTPS catalog URL required')
        require(item['url'] not in urls, 'Duplicate required catalog')
        urls.add(item['url'])

def register_collections(raw, required):
    """Append missing descriptors before the root array close; preserve old bytes."""
    validate_catalogs(required)
    text = raw.decode('utf8')
    obj = strict_json(text)
    require(type(obj) is dict and type(obj.get('entityCollections')) is list, 'Root entityCollections array required')
    existing = obj['entityCollections']
    require(all(type(item) is dict and type(item.get('url')) is str for item in existing), 'Existing descriptor shape invalid')
    missing = []
    for wanted in required:
        matches = [item for item in existing if item['url'] == wanted['url']]
        require(all(item.get('type') == 'file' for item in matches), 'Conflicting existing catalog type')
        if not matches:
            missing.append(wanted)
    if not missing:
        return raw, []
    decoder = json.JSONDecoder()
    position = text.index('{') + 1
    while True:
        position += re.match(r'\s*', text[position:]).end()
        key, position = decoder.raw_decode(text, position)
        position = text.index(':', position) + 1
        position += re.match(r'\s*', text[position:]).end()
        start = position
        _, position = decoder.raw_decode(text, position)
        if key == 'entityCollections':
            break
        position += re.match(r'\s*', text[position:]).end()
        position += 1
    require(text[start] == '[' and text[position - 1] == ']', 'Literal root array required')
    insertion = (',' if existing else '') + json.dumps(missing, separators=(',', ':'), ensure_ascii=True)[1:-1]
    close = position - 1
    result = (text[:close] + insertion + text[close:]).encode('utf8')
    after = strict_json(result.decode('utf8'))
    require(after == {**obj, 'entityCollections': existing + missing}, 'Unexpected WAM semantic change')
    require((result.decode('utf8')[:close] + result.decode('utf8')[close + len(insertion):]).encode('utf8') == raw, 'Non-insertion byte change')
    return result, [item['url'] for item in missing]

def make_package(baseline, required, paths):
    validate_catalogs(required)
    require(type(paths) is list and bool(paths) and len(paths) == len(set(paths)), 'Exact unique WAM path list required')
    for path in paths:
        require(type(path) is str and re.fullmatch(r'maps/[a-z0-9-]+\.wam', path) and path in baseline and path[:-4] + '.tmj' in baseline, 'Missing, unsafe or unpaired WAM')
    package = dict(baseline)
    changes = []
    for path in sorted(paths):
        changed, added = register_collections(baseline[path], required)
        package[path] = changed
        if added:
            changes.append({'path': path, 'fromSha256': hashlib.sha256(baseline[path]).hexdigest(), 'toSha256': hashlib.sha256(changed).hexdigest(), 'addedUrls': added, 'allOriginalBytesRetained': True})
    return package, changes

def source_policy(root):
    catalogs_raw = (root / 'world/editor-collections.json').read_bytes()
    catalogs = strict_json(catalogs_raw.decode('utf8'))
    validate_catalogs(catalogs)
    manifest = strict_json((root / 'publication/source-manifest.json').read_text())
    paths = sorted(path for path in manifest['sourceInventory'] if re.fullmatch(r'maps/[a-z0-9-]+\.wam', path))
    require(len(paths) == 33, 'Reviewed VarCamp33-map scope required')
    return catalogs, hashlib.sha256(catalogs_raw).hexdigest(), paths

def main():
    parser = argparse.ArgumentParser(description='Prepare then apply only explicit native editor collection registrations')
    parser.add_argument('action', choices=['prepare', 'apply'])
    parser.add_argument('--source-root', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parent.parent)
    parser.add_argument('--environment', type=pathlib.Path, required=True)
    parser.add_argument('--plan', type=pathlib.Path, required=True)
    parser.add_argument('--target', default='varcamp-demo')
    parser.add_argument('--quiet-editor-window', action='store_true')
    args = parser.parse_args()
    require(args.target == 'varcamp-demo', 'Explicit reviewed VarCamp target only')
    catalogs, policy_hash, paths = source_policy(args.source_root)
    storage = Storage(args.environment)
    plan = args.plan
    if args.action == 'prepare':
        require(not plan.exists(), 'Use a fresh plan; never overwrite retained baseline')
        original = storage.download(args.target)
        baseline = read_zip(original)
        package, changes = make_package(baseline, catalogs, paths)
        require(bool(changes), 'Collections already registered; no mutation needed')
        document = {'catalogMigrationVersion': 1, 'intent': 'append-native-entity-collections', 'target': args.target, 'catalogs': catalogs, 'policySha256': policy_hash, 'paths': paths, 'baseline': inventory(baseline), 'package': inventory(package), 'changes': changes}
        plan.mkdir(parents=True)
        (plan / 'baseline.zip').write_bytes(original)
        (plan / 'package.zip').write_bytes(zip_bytes(package))
        (plan / 'plan.json').write_text(json.dumps(document, indent=2) + '\n')
        print(json.dumps({'prepared': str(plan), 'changedWams': len(changes), 'completeFiles': len(package), 'scope': 'entityCollections insertions only', 'uploaded': False}))
    else:
        require(args.quiet_editor_window, 'Quiet editor window required')
        document = strict_json((plan / 'plan.json').read_text())
        baseline = read_zip((plan / 'baseline.zip').read_bytes())
        package = read_zip((plan / 'package.zip').read_bytes())
        rebuilt, changes = make_package(baseline, catalogs, paths)
        expected = {'catalogMigrationVersion': 1, 'intent': 'append-native-entity-collections', 'target': args.target, 'catalogs': catalogs, 'policySha256': policy_hash, 'paths': paths, 'baseline': inventory(baseline), 'package': inventory(rebuilt), 'changes': changes}
        require(document == expected and package == rebuilt and bool(changes), 'Prepared intent or bytes changed; reconcile before applying')
        # Reuse the unchanged two preflight reads / upload / two delayed readbacks.
        receipts = apply_plan(storage, args.target, document['baseline'], package, document['package'])
        for index, data in enumerate(receipts, 1):
            (plan / ('readback-' + str(index) + '.zip')).write_bytes(data)
        print(json.dumps({'upload': 200, 'changedWams': len(changes), 'completeReadbacks': len(receipts), 'completeFiles': len(package)}))

if __name__ == '__main__':
    main()
