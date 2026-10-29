"""Independent read-only geometry audit; no map-builder or historical fixtures."""
from collections import Counter, deque
from pathlib import Path
import hashlib
import json
import math
import struct

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / '.qa/map-stability-audit'
OUT.mkdir(parents=True, exist_ok=True)
read = lambda path: json.loads((ROOT / path).read_text())
catalog = read('art/tile-catalog.json')
layouts = {p.stem: json.loads(p.read_text()) for p in (ROOT / 'world/layouts').glob('*.json')}
report = {'head': None, 'maps': [], 'issues': [], 'reviews': [], 'totals': Counter()}

def issue(mapid, code, location, detail):
    report['issues'].append(dict(map=mapid, code=code, location=location, detail=detail))

def review(mapid, code, location, detail):
    report['reviews'].append(dict(map=mapid, code=code, location=location, detail=detail))

def props(o):
    return {p['name']: p.get('value') for p in o.get('properties', [])}

def flatten(layers, ox=0, oy=0):
    for l in layers:
        x = ox + l.get('x', 0) + l.get('offsetx', 0) / 32
        y = oy + l.get('y', 0) + l.get('offsety', 0) / 32
        if l['type'] == 'group':
            yield from flatten(l['layers'], x, y)
        else:
            yield l, x, y

def cells(rect):
    return {(x, y) for y in range(rect['y'], rect['y'] + rect['height'])
            for x in range(rect['x'], rect['x'] + rect['width'])}

def neighbors(p, w, h):
    x, y = p
    return [(nx, ny) for nx, ny in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)]
            if 0 <= nx < w and 0 <= ny < h]

def flood(start, blocked, w, h):
    if start in blocked:
        return set()
    seen = {start}
    q = deque([start])
    while q:
        for p in neighbors(q.popleft(), w, h):
            if p not in seen and p not in blocked:
                seen.add(p)
                q.append(p)
    return seen

def sample(points):
    return sorted(points, key=lambda p: (p[1], p[0]))[:20]

assets = {}
used_sprites = Counter()
for mapid, layout in sorted(layouts.items()):
    m = read('maps/' + mapid + '.tmj')
    wam = read('maps/' + mapid + '.wam')
    w, h = m['width'], m['height']
    native_blocked, portals, terrain_cells = set(), set(), set()
    starts, exits, ranges, collides = {}, {}, [], set()
    object_ids, layer_ids, layer_names = set(), set(), set()
    object_count = 0
    tiles_count = 0
    for t in m['tilesets']:
        first, end = t['firstgid'], t['firstgid'] + t['tilecount']
        if any(first < b and end > a for a, b in ranges):
            issue(mapid, 'OVERLAPPING_GIDS', t['name'], [first, end])
        ranges.append((first, end))
        if t.get('image'):
            path = (ROOT / 'maps' / t['image']).resolve()
            if path not in assets:
                data = path.read_bytes()
                assets[path] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
                                'size': list(struct.unpack('>II', data[16:24]))}
            if assets[path]['size'] != [t['imagewidth'], t['imageheight']]:
                issue(mapid, 'ATLAS_DIMENSIONS', t['name'], assets[path]['size'])
        for tile in t.get('tiles', []):
            if props(tile).get('collides') is True:
                collides.add(first + tile['id'])
            for frame in tile.get('animation', []):
                if not 0 <= frame['tileid'] < t['tilecount'] or frame['duration'] <= 0:
                    issue(mapid, 'ANIMATION_FRAME', t['name'], frame)
    for layer, ox, oy in flatten(m['layers']):
        if layer['id'] in layer_ids or layer['name'] in layer_names:
            issue(mapid, 'DUPLICATE_LAYER', layer['name'], layer['id'])
        layer_ids.add(layer['id'])
        layer_names.add(layer['name'])
        if layer['type'] == 'objectgroup':
            for obj in layer['objects']:
                object_count += 1
                if obj['id'] in object_ids:
                    issue(mapid, 'DUPLICATE_OBJECT', obj['name'], obj['id'])
                object_ids.add(obj['id'])
                if (obj['x'] + ox * 32 < 0 or obj['y'] + oy * 32 < 0 or
                    obj['x'] + ox * 32 + obj['width'] > w * 32 or
                    obj['y'] + oy * 32 + obj['height'] > h * 32):
                    issue(mapid, 'OBJECT_BOUNDS', obj['name'], {k: obj[k] for k in ['x','y','width','height']})
        if layer['type'] != 'tilelayer':
            continue
        occupied = set()
        for i, raw in enumerate(layer['data']):
            gid = raw & 0x0fffffff
            if not gid:
                continue
            tiles_count += 1
            p = (i % layer['width'] + ox, i // layer['width'] + oy)
            occupied.add(p)
            if gid in collides:
                native_blocked.add(p)
        lp = props(layer)
        if layer['name'] == 'terrain':
            terrain_cells = occupied
        if layer['name'] == 'start' or lp.get('start') or lp.get('startLayer'):
            starts[layer['name']] = occupied
        if 'exitUrl' in lp:
            exits[layer['name']] = {'cells': occupied, 'url': lp['exitUrl']}
            portals |= occupied
    ground, objects = set(), set()
    placement_ids = set()
    for p in layout['placements']:
        used_sprites[p['sprite']] += 1
        if p['id'] in placement_ids:
            issue(mapid, 'DUPLICATE_PLACEMENT', p['id'], None)
        placement_ids.add(p['id'])
        s = catalog[p['sprite']]
        sw, sh = s['rect']['width'], s['rect']['height']
        mask = {tuple(c) for c in s['blockingCells']}
        footprint = cells(p)
        if any(not (0 <= x < w and 0 <= y < h) for x, y in footprint):
            issue(mapid, 'PLACEMENT_BOUNDS', p['id'], None)
        for x, y in footprint:
            dx, dy = (x-p['x']) % sw, (y-p['y']) % sh
            if p.get('flipY'):
                dy = sh-1-dy
            solid = (dx, dy) in mask
            if p['layer'] == 'terrain':
                if solid: ground.add((x,y))
                else: ground.discard((x,y))
            elif solid:
                objects.add((x,y))
    expected = ground | objects
    if expected != native_blocked:
        issue(mapid, 'COLLISION_PROJECTION', 'all placements',
              {'missing': sample(expected-native_blocked), 'extra': sample(native_blocked-expected),
               'missingCount': len(expected-native_blocked), 'extraCount': len(native_blocked-expected)})
    default = next(e for e in layout['entries'] if e.get('isDefault'))
    safe = flood((default['x'], default['y']), native_blocked | portals, w, h)
    for e in layout['entries']:
        ec = cells(e)
        if starts.get(e['name']) != ec:
            issue(mapid, 'ENTRY_PROJECTION', e['name'], None)
        if ec - safe:
            issue(mapid, 'ENTRY_UNREACHABLE_WITHOUT_TELEPORT', e['name'], sample(ec-safe))
    for e in layout['exits']:
        ec = cells(e)
        actual = exits.get('exit-' + e['name'])
        if not actual or actual['cells'] != ec or actual['url'] != e['destination']+'.wam#'+e['entry']:
            issue(mapid, 'EXIT_PROJECTION', e['name'], None)
        target = layouts.get(e['destination'])
        if target is None or e['entry'] not in [p['name'] for p in target['entries']]:
            issue(mapid, 'EXIT_DESTINATION', e['name'], [e['destination'],e['entry']])
        bad = {p for p in ec if p in native_blocked or not any(n in safe for n in neighbors(p,w,h))}
        if bad:
            issue(mapid, 'EXIT_BLOCKED_OR_UNREACHABLE', e['name'], sample(bad))
    for a in wam['areas']:
        ac = {(x,y) for y in range(math.floor(a['y']/32), math.ceil((a['y']+a['height'])/32))
              for x in range(math.floor(a['x']/32), math.ceil((a['x']+a['width'])/32))}
        if not ac or not ac & safe:
            issue(mapid, 'AREA_UNREACHABLE', a['name'], {'cells':sample(ac)})
        elif ac - safe:
            review(mapid, 'AREA_PARTIALLY_BLOCKED', a['name'], {'blocked':sample(ac-safe),'total':len(ac)})
    blank = safe-terrain_cells
    if blank:
        issue(mapid, 'WALKABLE_VOID', 'terrain', {'count':len(blank),'cells':sample(blank)})
    edge = {p for p in safe if p[0] in [0,w-1] or p[1] in [0,h-1]}
    if edge:
        review(mapid, 'WALKABLE_MAP_EDGE', 'boundary', sample(edge))
    remaining = {(x,y) for y in range(h) for x in range(w)} - native_blocked - portals - safe
    components = []
    while remaining:
        component = flood(next(iter(remaining)), native_blocked|portals, w,h)
        components.append({'size':len(component),'cells':sample(component)})
        remaining -= component
    if components:
        review(mapid, 'ISOLATED_WALKABLE_COMPONENTS', 'navigation', components)
    row = dict(map=mapid, dimensions=[w,h], placements=len(layout['placements']),
               nativeObjects=object_count, paintedTiles=tiles_count, blockedTiles=len(native_blocked),
               safeReachableTiles=len(safe), entries=len(starts), exits=len(exits),
               areas=len(wam['areas']), entities=len(wam['entities']), tilesets=len(m['tilesets']),
               isolatedComponents=len(components))
    report['maps'].append(row)
    for k,v in row.items():
        if isinstance(v,int):report['totals'][k]+=v

report['assets'] = {str(p.relative_to(ROOT)):v for p,v in sorted(assets.items())}
report['usedSprites'] = dict(used_sprites)
report['summary'] = {'maps':len(report['maps']), 'assets':len(assets), 'usedSprites':len(used_sprites),
                     'issues':len(report['issues']), 'reviewItems':len(report['reviews'])}
(OUT/'static-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report['summary']))
print(json.dumps(report['totals']))
for row in report['issues']: print(json.dumps(row))
for row in report['reviews']: print(json.dumps(row))
