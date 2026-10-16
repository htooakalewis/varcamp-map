"""Exercise preparation with real ZIPs and files; replace only remote storage."""
import hashlib
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import release_upload as publisher

IDS = ['overworld','campus-exploration','solar-hall','lunar-hall','fire-district','earth-district','air-district','water-district','orbit-maze','hidden-observatory','nebula-arcade','zodiac-festival-park','shipyard-beach','comet-maze','orbit-playground','constellation-shore','fa-ship','star-garden','moon-cafe','moon-grotto','stargazer-terrace'] + ['speaker-'+s for s in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')]
FINAL = b'final native map'
PIN = hashlib.sha256(FINAL).hexdigest()
OLD = '0'*64

def wam(name, pin=PIN):
    return ('{ "mapUrl": "'+name+'.tmj?v='+pin+'", "entities": [{"id":"editor-owned"}], "areas": [], "metadata": {"custom": true} }\n').encode()

class GraphTests(unittest.TestCase):
    def prepare(self, live, reviewed=None):
        original = os.getcwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                pathlib.Path('dist/maps').mkdir(parents=True)
                for name in IDS:
                    pathlib.Path('dist/maps/'+name+'.tmj').write_bytes(FINAL)
                    pathlib.Path('dist/maps/'+name+'.wam').write_bytes(wam(name))
                class Storage:
                    def __init__(self, *args): pass
                    def download(self, target): return publisher.zip_bytes(live)
                argv = ['publisher','prepare','--plan','plan','--target','candidate']
                if reviewed is not None:
                    pathlib.Path('reviewed.zip').write_bytes(publisher.zip_bytes(reviewed))
                    argv += ['--reviewed-wams','reviewed.zip']
                with patch.object(publisher, 'Storage', Storage), patch.object(sys, 'argv', argv):
                    publisher.main()
                return json.loads(pathlib.Path('plan/plan.json').read_text()), publisher.read_zip(pathlib.Path('plan/package.zip').read_bytes())
            finally:
                os.chdir(original)

    def test_stale_preserved_pin_aborts_preparation(self):
        with self.assertRaisesRegex(ValueError, 'overworld.wam'):
            self.prepare({'maps/overworld.wam': wam('overworld', OLD)})

    def test_exact_pin_preserves_live_bytes(self):
        live = wam('overworld').replace(b'editor-owned', b'custom-editor-id')
        manifest, package = self.prepare({'maps/overworld.wam': live})
        self.assertNotIn('maps/overworld.wam', package)
        self.assertEqual(manifest['expected']['maps/overworld.wam'], hashlib.sha256(live).hexdigest())

    def test_reviewed_token_migration_binds_identities(self):
        before, after = wam('overworld', OLD), wam('overworld')
        manifest, package = self.prepare({'maps/overworld.wam': before}, {'maps/overworld.wam': after})
        self.assertEqual(package['maps/overworld.wam'], after)
        self.assertEqual(manifest['wamDependencies']['maps/overworld.wam'], {
            'tmj': 'maps/overworld.tmj', 'tmjSha256': PIN,
            'fromWamSha256': hashlib.sha256(before).hexdigest(),
            'toWamSha256': hashlib.sha256(after).hexdigest(), 'reviewed': True})

    def test_wrong_and_malformed_mappings_fail_closed(self):
        for data in [b'not json', b'{}', wam('other'), wam('overworld').replace(b'true', b'NaN'), wam('overworld').replace(b'"custom": true', b'"custom": true, "custom": false'), wam('overworld').replace(b'overworld.tmj', b'https://other.test/overworld.tmj'), wam('overworld').replace(b'?v=', b'?x='), wam('overworld').replace(b'.tmj?', b'.tmj?extra=1&'), wam('overworld').replace(b'"metadata":', b'"mapUrl":"duplicate", "metadata":')]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                self.prepare({'maps/overworld.wam': data})

    def test_reviewed_metadata_or_format_rewrite_is_rejected(self):
        before = wam('overworld', OLD)
        for after in [wam('overworld').replace(b'editor-owned', b'changed'), wam('overworld').replace(b'{ ', b'{'), wam('other')]:
            with self.subTest(after=after), self.assertRaises(ValueError):
                self.prepare({'maps/overworld.wam': before}, {'maps/overworld.wam': after})

class ApplyGraphTests(unittest.TestCase):
    def apply(self, change=None, migration=False):
        original = os.getcwd()
        before = wam('overworld', OLD if migration else PIN)
        after = wam('overworld')
        baseline = {'maps/overworld.wam': before, 'maps/overworld.tmj': b'old'}
        release = {'maps/overworld.wam': after, 'maps/overworld.tmj': FINAL}
        package = {'maps/overworld.tmj': FINAL}
        if migration:
            package['maps/overworld.wam'] = after
        expected = baseline | package
        manifest = {'planVersion': 2, 'target': 'candidate',
                    'baseline': publisher.inventory(baseline), 'package': publisher.inventory(package),
                    'expected': publisher.inventory(expected),
                    'reviewedWams': publisher.inventory({'maps/overworld.wam': after} if migration else {}),
                    'preservedWams': [] if migration else ['maps/overworld.wam'],
                    'wamDependencies': {'maps/overworld.wam': {
                        'tmj': 'maps/overworld.tmj', 'tmjSha256': PIN,
                        'fromWamSha256': hashlib.sha256(before).hexdigest(),
                        'toWamSha256': hashlib.sha256(after).hexdigest(), 'reviewed': migration}}}
        if change:
            change(manifest, baseline, release, package)
        self.uploads = 0
        test = self
        class Storage:
            def __init__(self, *args): pass
            def download(self, target):
                return publisher.zip_bytes((baseline | package) if test.uploads else baseline)
            def upload(self, target, files):
                test.uploads += 1
                return 200
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                pathlib.Path('plan').mkdir()
                for name, files in [('baseline', baseline), ('release', release), ('package', package)]:
                    pathlib.Path('plan/'+name+'.zip').write_bytes(publisher.zip_bytes(files))
                pathlib.Path('plan/plan.json').write_text(json.dumps(manifest))
                argv = ['publisher', 'apply', '--plan', 'plan', '--quiet-editor-window']
                with patch.object(publisher, 'Storage', Storage), patch.object(sys, 'argv', argv), patch('time.sleep'):
                    publisher.main()
            finally:
                os.chdir(original)

    def test_legacy_stale_plan_rejected_before_upload(self):
        def legacy(manifest, baseline, release, package):
            manifest.pop('planVersion')
            manifest.pop('wamDependencies')
            baseline['maps/overworld.wam'] = wam('overworld', OLD)
            manifest['baseline'] = publisher.inventory(baseline)
            manifest['expected'] = publisher.inventory(baseline | package)
        with self.assertRaises(ValueError):
            self.apply(legacy)
        self.assertEqual(self.uploads, 0)

    def test_missing_or_inconsistent_contract_rejected_before_upload(self):
        def missing(manifest, *_): manifest.pop('wamDependencies')
        def altered(manifest, *_): manifest['wamDependencies']['maps/overworld.wam']['tmjSha256'] = OLD
        def omitted(manifest, *_): manifest['wamDependencies'] = {}
        def wrong_expected(manifest, *_): manifest['expected']['maps/overworld.wam'] = OLD
        def wrong_review(manifest, *_): manifest['reviewedWams'] = {}
        for change in [missing, altered, omitted, wrong_expected, wrong_review]:
            with self.subTest(change=change.__name__), self.assertRaises(ValueError):
                self.apply(change, migration=True)
            self.assertEqual(self.uploads, 0)

    def test_schema_valid_stale_graph_rejected_before_upload(self):
        def stale(manifest, baseline, release, package):
            baseline['maps/overworld.wam'] = wam('overworld', OLD)
            manifest['baseline'] = publisher.inventory(baseline)
            manifest['expected'] = publisher.inventory(baseline | package)
            edge = manifest['wamDependencies']['maps/overworld.wam']
            edge['fromWamSha256'] = edge['toWamSha256'] = hashlib.sha256(baseline['maps/overworld.wam']).hexdigest()
            edge['tmjSha256'] = OLD
        with self.assertRaises(ValueError):
            self.apply(stale)
        self.assertEqual(self.uploads, 0)

    def test_exact_preserved_and_reviewed_graphs_apply(self):
        for migration in [False, True]:
            with self.subTest(migration=migration):
                self.apply(migration=migration)
                self.assertEqual(self.uploads, 1)

if __name__ == '__main__': unittest.main()
