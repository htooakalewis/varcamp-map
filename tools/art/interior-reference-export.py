"""Export original generated furniture to the reviewed native32px atlas.

Only crop, aspect-preserving nearest-neighbor scale and alpha placement are
performed. The master PNG and exact crop decisions remain independently saved.
"""
from pathlib import Path
import hashlib
import json
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
metadata = json.loads((ROOT / 'art/source/interior-reference.json').read_bytes())
master = ROOT / metadata['originalMaster']
assert hashlib.sha256(master.read_bytes()).hexdigest() == metadata['originalMasterSha256']
source = Image.open(master).convert('RGBA')
atlas = Image.new('RGBA', tuple(metadata['atlasSize']))
for row in metadata['sprites']:
    width, height = row['rect']['width'], row['rect']['height']
    sprite = source.crop(row['crop'])
    sprite.thumbnail((width * 32 - 4, height * 32 - 4), Image.Resampling.NEAREST)
    assert list(sprite.size) == row['exportPixels']
    atlas.alpha_composite(sprite, tuple(row['pastePixels']))
from io import BytesIO
buffer = BytesIO()
atlas.save(buffer, format='PNG')
raw = buffer.getvalue()
assert hashlib.sha256(raw).hexdigest() == metadata['atlasSha256']
targets = (ROOT / metadata['atlas'], ROOT / 'art/source/interior-reference-native.png')
if '--check' in sys.argv:
    assert all(path.read_bytes() == raw for path in targets)
    print('Generated master, exact crops and both native PNG bodies verified.')
else:
    for path in targets:
        path.write_bytes(raw)
    print('Exported the exact reviewed generated furniture PNG bodies.')
