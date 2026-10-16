"""Fail-closed live-area migration for the explicitly approved VarCamp redraw.

This does not upload. The publisher still compares the complete fresh baseline
before replacing anything. Unknown areas or any live furniture need review.
"""
import copy
import json

MOVED = {
    ('campus-exploration', 'garden-conversation'): 'star-garden',
    ('campus-exploration', 'playground-conversation'): 'orbit-playground',
    ('campus-exploration', 'cafe-west'): 'moon-cafe',
    ('campus-exploration', 'cafe-east'): 'moon-cafe',
    ('campus-exploration', 'observatory-telescope'): 'stargazer-terrace',
    **{('shipyard-beach', name): 'fa-ship' for name in
       ('cargo-deck', 'fa-ship-cockpit', 'fa-ship-cargo', 'fa-ship-lounge')},
    **{('shipyard-beach', name): 'constellation-shore' for name in
       ('beach-games', 'picnic-bay', 'shore-lounge')},
    **{(element + '-district', 'beacon-' + sign): 'speaker-' + sign
       for element, signs in {
           'fire': ('aries', 'leo', 'sagittarius'),
           'earth': ('taurus', 'virgo', 'capricorn'),
           'air': ('gemini', 'libra', 'aquarius'),
           'water': ('cancer', 'scorpio', 'pisces'),
       }.items() for sign in signs},
}
GEOMETRY = ('x', 'y', 'width', 'height')


def checked_areas(wam):
    areas = wam['areas']
    if len({a['name'] for a in areas}) != len(areas) or len({a['id'] for a in areas}) != len(areas):
        raise ValueError('Ambiguous area name or ID requires review')
    return {a['name']: a for a in areas}


def migrate_wams(live, release):
    """Keep live fields/properties; adopt only reviewed geometry and map URLs."""
    result = {p: json.loads(b) for p, b in release.items() if p.endswith('.wam')}
    targets = {p: checked_areas(w) for p, w in result.items()}
    report = []
    seen_targets = set()
    for path, data in live.items():
        if not path.endswith('.wam'):
            continue
        if path not in result:
            raise ValueError('Uncatalogued live WAM requires review: ' + path)
        old = json.loads(data)
        if old.get('entities'):
            raise ValueError('Live furniture requires an explicit relocation review: ' + path)
        checked_areas(old)
        # Retain human titles, room settings, collections and any future metadata.
        for key, value in old.items():
            if key not in ('areas', 'mapUrl'):
                result[path][key] = copy.deepcopy(value)
        map_id = path.removeprefix('maps/').removesuffix('.wam')
        for area in old['areas']:
            destination = MOVED.get((map_id, area['name']), map_id)
            target_path = 'maps/' + destination + '.wam'
            target = targets.get(target_path, {}).get(area['name'])
            if target is None:
                raise ValueError('Unreviewed live area: ' + path + ':' + area['name'])
            target_key = (target_path, area['name'])
            if target_key in seen_targets:
                raise ValueError('Multiple live areas target the same new area')
            seen_targets.add(target_key)
            geometry = {key: target[key] for key in GEOMETRY}
            # IDs and complete property objects travel with the old live area.
            target.update(copy.deepcopy(area))
            target.update(geometry)
            report.append({'from': path, 'to': target_path, 'name': area['name'],
                           'id': area['id'],
                           'before': {key: area[key] for key in GEOMETRY},
                           'after': geometry, 'propertiesPreserved': target['properties'] == area['properties']})
    for wam in result.values():
        checked_areas(wam)
    return {p: (json.dumps(w, indent=2) + '\n').encode() for p, w in result.items()}, report
