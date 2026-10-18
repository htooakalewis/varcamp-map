"""Independent offline reproductions on the real CLI/loader/journal/operator path.

Run: isolated-python this-file.py ABSOLUTE-SERVICE-SOURCE [unittest selection]
Only the Docker provider and deterministic elapsed clock are TEST peers.
"""
import contextlib, io, json, pathlib, sys, tempfile, time, unittest
from unittest.mock import patch

SOURCE = pathlib.Path(__file__).resolve().parents[1]
sys.path[:0] = [str(SOURCE), str(SOURCE / 'tests')]
from test_entry import value, stage
from helpers import FakeEngine, plan as test_plan
from service.service_cli import main
from service.service_plan import load_plan
from service import release_binding, runtime_predicates as runtime
from service.owned_client import CaptureFailure, Failure
from service.service_journal import Journal
from service.failure_record import retain_failure


@contextlib.contextmanager
def entry_case(peer_class):
    with tempfile.TemporaryDirectory() as tmp:
        directory = pathlib.Path(tmp)
        directory.chmod(0o700)
        v = value()
        sha = stage(directory, v)
        with patch.object(release_binding, 'REVIEWED_PLAN_SHA256', sha), patch.object(release_binding, 'REVIEWED_RELEASE', v['release']):
            plan = load_plan(directory, sha)
            peer = peer_class(plan)
            with patch('service.service_engine.DockerEngine', return_value=peer), patch.object(runtime, 'APP', plan.release['app']), patch.object(runtime, 'EXECUTING_SOURCES', plan.release['executingSources']):
                yield directory, sha, peer


def invoke(directory, sha):
    with contextlib.redirect_stdout(io.StringIO()) as output:
        code = main(['start', 'lyra', str(directory), sha])
    return code, json.loads(output.getvalue())


class ExpiredReadinessPeer(FakeEngine):
    """Reach the unchanged startup150 end only after acknowledged START."""
    def __init__(self, plan):
        super().__init__(plan)
        self.elapsed = 0
        self.advanced = False
        self.original_mutation_ends = []
        self.cleanup_ends = []
        self.cleanup_inspect_ends = []

    def create(self, args, end):
        self.original_mutation_ends.append(('create', end))
        return super().create(args, end)

    def start(self, identity, end):
        self.original_mutation_ends.append(('start', end))
        return super().start(identity, end)

    def inspect(self, identity, end):
        if self.advanced:
            self.cleanup_inspect_ends.append(end)
        item = super().inspect(identity, end)
        if item['State']['Running'] and not self.advanced:
            self.advanced = True
            self.elapsed = 151
            item['State']['Health']['Status'] = 'starting'
        return item

    def stop(self, identity, end):
        self.cleanup_ends.append(('stop', end))
        return super().stop(identity, end)

    def remove(self, identity, end):
        self.cleanup_ends.append(('remove', end))
        return super().remove(identity, end)


class DiagnosticCapturePeer(FakeEngine):
    stdout = b'\x00TEST partial diagnostic stdout\xff'
    stderr = b'\xfeTEST partial diagnostic stderr\x00'
    def __init__(self, plan):
        super().__init__(plan)
        self.fail = 'terminal-health'

    def logs(self, identity, end):
        self.calls.append(('logs', identity))
        raise CaptureFailure(Failure('TEST partial diagnostic capture', self.stdout, self.stderr, 4097, True))


class UncertainReadinessPeer(FakeEngine):
    def __init__(self, plan):
        super().__init__(plan)
        self.health_attempts = 0

    def health(self, identity, end):
        self.health_attempts += 1
        raise CaptureFailure(Failure('TEST unsettled readiness client', b'partial-health', b'local-close-error', 35, False))


class UncertainDiagnosticPeer(DiagnosticCapturePeer):
    def logs(self, identity, end):
        self.calls.append(('logs', identity))
        raise CaptureFailure(Failure('TEST unsettled diagnostic client', self.stdout, self.stderr, 4097, False))


class ExpiredCreatePeer(ExpiredReadinessPeer):
    def create(self, args, end):
        identity = super().create(args, end)
        self.elapsed = 26
        return identity


class UncertainFDReadinessPeer(FakeEngine):
    def health(self, identity, end):
        error = OSError('TEST uncertain readiness input FD')
        error.uncertain_fd = 12345  # TEST identity, never an open descriptor.
        raise error


class UncertainHealthDiagnosticPeer(DiagnosticCapturePeer):
    def __init__(self, plan):
        super().__init__(plan)
        self.health_attempts = 0

    def health(self, identity, end):
        self.health_attempts += 1
        if self.health_attempts == 2:
            raise CaptureFailure(Failure('TEST unsettled health diagnostic client', b'partial-health', b'close-error', 27, False))
        return super().health(identity, end)


class ReviewRegressions(unittest.TestCase):
    def test_expired_normal_startup_can_still_settle_failure_and_clean_known_id(self):
        # Bug caught: failure journaling borrows expired operation end and poisons
        # the journal before the separate bounded terminal cleanup can run.
        with entry_case(ExpiredReadinessPeer) as (directory, sha, peer):
            actual_monotonic = time.monotonic
            began = actual_monotonic()
            with patch('service.service_operator.time.monotonic', side_effect=lambda: actual_monotonic() + peer.elapsed):
                code, result = invoke(directory, sha)
            self.assertEqual(code, 2)
            self.assertIn('Original startup150s elapsed', result['firstMessage'])
            self.assertEqual(len(peer.objects), 0, 'Known fully attested running ID must receive bounded cleanup after ordinary startup expiry')
            state = json.loads((directory / 'service-state.json').read_bytes())
            self.assertEqual(state['firstFailure']['type'], 'TimeoutError')
            self.assertEqual(state['members']['lyra']['state'], 'removed')
            self.assertEqual([op for op, _ in peer.calls].count('create'), 1)
            self.assertEqual([op for op, _ in peer.calls].count('start'), 1)
            self.assertLessEqual(peer.original_mutation_ends[0][1] - began, 25.1)
            self.assertLessEqual(peer.original_mutation_ends[1][1] - began, 5.1)
            self.assertLessEqual(peer.cleanup_ends[0][1] - (began + 151), 12.1)
            self.assertLessEqual(peer.cleanup_ends[1][1] - (began + 151), 2.1)

    def test_expired_create_keeps_unknown_durable_without_retry_or_adoption(self):
        # Expired operation settlement must not poison the separate terminal
        # journal scope; the unavailable acknowledged ID remains unknown.
        with entry_case(ExpiredCreatePeer) as (directory, sha, peer):
            actual_monotonic = time.monotonic
            with patch('service.service_operator.time.monotonic', side_effect=lambda: actual_monotonic() + peer.elapsed):
                code, result = invoke(directory, sha)
            self.assertEqual(code, 2)
            self.assertIn('Original mutation settled late', result['firstMessage'])
            state = json.loads((directory / 'service-state.json').read_bytes())
            self.assertIsNotNone(state['firstFailure'], 'Late mutation must durably preserve original first failure in terminal scope')
            self.assertEqual(state['firstFailure']['operation'], 'create')
            self.assertEqual(state['members']['lyra']['state'], 'unknown')
            self.assertIsNone(state['members']['lyra']['id'])
            self.assertEqual(state['pending'], {'persona': 'lyra', 'operation': 'create'})
            self.assertEqual([op for op, _ in peer.calls].count('create'), 1)
            self.assertNotIn('start', [op for op, _ in peer.calls])
            self.assertNotIn('stop', [op for op, _ in peer.calls])
            self.assertNotIn('remove', [op for op, _ in peer.calls])

    def test_terminal_journal_consumes_same_original_cleanup_interval(self):
        # Bug caught: silently starting a new15s cleanup end after journaling.
        with entry_case(ExpiredReadinessPeer) as (directory, sha, peer):
            actual_monotonic = time.monotonic
            original_fail = Journal.fail
            failure_calls = []
            def consume_terminal_scope(journal, p, operation, error, end, unknown=False):
                failure_calls.append((time.monotonic(), end))
                original_fail(journal, p, operation, error, end, unknown=unknown)
                if len(failure_calls) == 1:
                    peer.elapsed += 14
            with patch('service.service_operator.time.monotonic', side_effect=lambda: actual_monotonic() + peer.elapsed), patch.object(Journal, 'fail', consume_terminal_scope):
                code, result = invoke(directory, sha)
            self.assertEqual(code, 2)
            self.assertEqual(len(peer.objects), 0)
            self.assertLessEqual(failure_calls[0][1] - failure_calls[0][0], .251)
            self.assertLessEqual(peer.cleanup_inspect_ends[0] - failure_calls[0][0], 15.001)
            self.assertLessEqual(peer.cleanup_ends[0][1] - (failure_calls[0][0] + 14), 1.001)

    def test_secondary_capture_keeps_binary_streams_and_incompleteness_on_disk(self):
        # Bug caught: CLI exit discards raw partial secondary CaptureFailure.
        with entry_case(DiagnosticCapturePeer) as (directory, sha, peer):
            code, result = invoke(directory, sha)
            self.assertEqual(code, 2)
            self.assertEqual(peer.objects, {})
            records = list(directory.glob('failure-*/record.json'))
            self.assertEqual(len(records), 1)
            record = json.loads(records[0].read_bytes())
            row = next(r for r in record['secondary'] if r['type'] == 'CaptureFailure')
            self.assertIn('stdout', row, 'Secondary capture raw partial stdout must survive CLI exit')
            self.assertEqual((records[0].parent / row['stdout']['file']).read_bytes(), peer.stdout)
            self.assertEqual((records[0].parent / row['stderr']['file']).read_bytes(), peer.stderr)
            self.assertEqual(row['received'], 4097)
            self.assertIs(row['captureIsComplete'], False)
            self.assertIs(row['client_settled'], True)

    def test_unsettled_readiness_client_blocks_new_cleanup_mutations(self):
        # Bug caught: uncertain local settlement is reported only after destructive
        # cleanup, rather than gating the next exact-ID operation.
        with entry_case(UncertainReadinessPeer) as (directory, sha, peer):
            code, result = invoke(directory, sha)
            self.assertEqual(code, 2)
            self.assertIs(result['localClosureCertain'], False)
            self.assertNotIn('stop', [op for op, _ in peer.calls], 'An unsettled readiness client must hold the known ID without a new STOP')
            self.assertNotIn('remove', [op for op, _ in peer.calls])
            self.assertEqual(len(peer.objects), 1)
            self.assertEqual(peer.health_attempts, 1, 'Uncertainty prevents the next diagnostic health client')
            self.assertNotIn('logs', [op for op, _ in peer.calls])

    def test_unsettled_diagnostic_client_blocks_new_cleanup_mutations(self):
        with entry_case(UncertainDiagnosticPeer) as (directory, sha, peer):
            code, result = invoke(directory, sha)
            self.assertEqual(code, 2)
            self.assertIs(result['localClosureCertain'], False)
            self.assertNotIn('stop', [op for op, _ in peer.calls], 'An unsettled diagnostic client must hold the known ID without a new STOP')
            self.assertNotIn('remove', [op for op, _ in peer.calls])
            self.assertEqual(len(peer.objects), 1)

    def test_uncertain_readiness_fd_blocks_new_cleanup_mutations(self):
        with entry_case(UncertainFDReadinessPeer) as (directory, sha, peer):
            code, result = invoke(directory, sha)
            self.assertEqual(code, 2)
            self.assertIs(result['localClosureCertain'], False)
            self.assertNotIn('stop', [op for op, _ in peer.calls])
            self.assertNotIn('remove', [op for op, _ in peer.calls])
            self.assertEqual(len(peer.objects), 1)

    def test_unsettled_health_diagnostic_blocks_later_logs_and_cleanup(self):
        with entry_case(UncertainHealthDiagnosticPeer) as (directory, sha, peer):
            code, result = invoke(directory, sha)
            self.assertEqual(code, 2)
            self.assertIs(result['localClosureCertain'], False)
            self.assertEqual(peer.health_attempts, 2)
            self.assertNotIn('logs', [op for op, _ in peer.calls])
            self.assertNotIn('stop', [op for op, _ in peer.calls])
            self.assertNotIn('remove', [op for op, _ in peer.calls])
            self.assertEqual(len(peer.objects), 1)


class ForensicRegressions(unittest.TestCase):
    def test_secondary_causes_share_eight_row_bound_and_preserve_first(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = pathlib.Path(tmp)
            directory.chmod(0o700)
            journal = Journal(directory, test_plan())
            first = ValueError('TEST original primary')
            raw = CaptureFailure(Failure('TEST nested partial', b'\x00out\xff', b'\xfestderr', 8193, True))
            wrapper = RuntimeError('TEST diagnostic wrapper')
            wrapper.__cause__ = raw
            secondary = [wrapper, *[OSError('TEST extra ' + str(i)) for i in range(7)]]
            try:
                retain_failure(journal, first, secondary, time.monotonic() + 5)
            finally:
                journal.close()
            record_path = next(directory.glob('failure-*/record.json'))
            record = json.loads(record_path.read_bytes())
            self.assertEqual(record['firstChain'][0]['message'], 'TEST original primary')
            self.assertEqual(len(record['firstChain']), 1)
            self.assertEqual(len(record['secondary']), 8)
            self.assertEqual(record['secondary'][0]['message'], 'TEST diagnostic wrapper')
            self.assertEqual(record['secondary'][1]['type'], 'CaptureFailure', 'Nested diagnostic cause must be retained before later rows')
            self.assertEqual((record_path.parent / record['secondary'][1]['stdout']['file']).read_bytes(), b'\x00out\xff')
            self.assertNotIn('TEST extra 6', [r['message'] for r in record['secondary']])


if __name__ == '__main__':
    unittest.main()
