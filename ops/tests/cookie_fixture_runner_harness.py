"""Exercise the actual CLI runner with dummy subprocess outcomes and I/O tripwires."""
import argparse
import contextlib
import io
import json
import os
import pathlib
import runpy
import socket
import subprocess
import sys
import tempfile
from unittest.mock import patch

SCENARIOS = [
    'ordinary', 'forced-removal', 'first-probe-255', 'final-probe-255',
    'removal-failure', 'remaining-fixture', 'run-failure', 'run-timeout',
    'first-probe-timeout', 'final-probe-timeout', 'removal-timeout',
    'run-and-cleanup-timeout', 'primary-and-cleanup-failure', 'run-oserror',
]


def exercise(runner, scenario):
    calls = []
    run_count = 0
    probe_count = 0
    fixture_name = None
    tripwire_calls = []

    def forbidden(*args, **kwargs):
        tripwire_calls.append('real subprocess or network attempted')
        raise AssertionError('Real subprocess/network forbidden in dummy runner regression')

    def transport(argv, **kwargs):
        nonlocal run_count, probe_count, fixture_name
        import shlex
        assert argv[:4] == ['ssh', '-o', 'BatchMode=yes', 'devbox'] and len(argv) == 5
        command = shlex.split(argv[4])
        assert command[0] == 'docker'
        if command[1] == 'run':
            run_count += 1
            probe_count = 0
            fixture_name = command[command.index('--name') + 1]
            assert fixture_name.startswith('varcamp-h2-cookie-fixture-')
            assert '--pull=never' in command and '--network=none' in command
            assert command[-2:] == ['dummy-only-image', '-']
            assert kwargs['timeout'] == 65 and kwargs['input'] == runner.with_name('cookie-fixture.cjs').read_text()
            step = 'run'
        elif command[1] == 'ps':
            assert command == ['docker', 'ps', '-aq', '--filter', 'name=^/' + fixture_name + '$']
            probe_count += 1
            assert probe_count <= 2 and kwargs['timeout'] == 20
            step = 'first-probe' if probe_count == 1 else 'final-probe'
        elif command[1] == 'rm':
            assert command == ['docker', 'rm', '-f', fixture_name] and kwargs['timeout'] == 20
            step = 'remove'
        else:
            raise AssertionError('Unexpected dummy transport command')
        calls.append({'step': step, 'argv': argv, 'timeout': kwargs['timeout']})
        first = run_count == 1
        stdout, stderr, code = '', '', 0
        if step == 'run':
            stdout = '{"dummyFixture":true}\n'
        if first:
            if scenario in ['forced-removal', 'removal-failure', 'removal-timeout'] and step == 'first-probe':
                stdout = 'abc123\n'
            if scenario == 'first-probe-255' and step == 'first-probe':
                code, stderr = 255, 'dummy SSH failure\n'
            if scenario == 'final-probe-255' and step == 'final-probe':
                code, stderr = 255, 'dummy Docker failure\n'
            if scenario == 'removal-failure' and step == 'remove':
                code, stderr = 1, 'dummy removal failure\n'
            if scenario == 'remaining-fixture' and step == 'final-probe':
                stdout = 'abc123\n'
            if scenario in ['run-failure', 'primary-and-cleanup-failure'] and step == 'run':
                code, stderr = 17, 'dummy primary fixture failure\n'
            if scenario == 'primary-and-cleanup-failure' and step == 'first-probe':
                code, stderr = 255, 'dummy cleanup failure\n'
            timeout_step = {
                'run-timeout': 'run', 'first-probe-timeout': 'first-probe',
                'final-probe-timeout': 'final-probe', 'removal-timeout': 'remove',
            }.get(scenario)
            if step == timeout_step or scenario == 'run-and-cleanup-timeout' and step in ['run', 'first-probe']:
                raise subprocess.TimeoutExpired(argv, kwargs['timeout'], output=b'dummy partial stdout\n', stderr=b'dummy partial stderr\n')
            if scenario == 'run-oserror' and step == 'run':
                raise OSError('dummy launch failure')
        return subprocess.CompletedProcess(argv, code, stdout, stderr)

    with tempfile.TemporaryDirectory(prefix='cookie-runner-dummy-') as directory:
        evidence = pathlib.Path(directory)
        (evidence / 'fixture-tls.key').write_bytes(b'dummy synthetic key')
        (evidence / 'fixture-tls.crt').write_bytes(b'dummy synthetic cert')
        stdout = io.StringIO()
        stderr = io.StringIO()
        cli_exit = None
        raised = None
        with patch.object(subprocess, 'run', transport), patch.object(subprocess, 'Popen', forbidden), \
                patch.object(socket, 'socket', forbidden), patch.object(socket, 'create_connection', forbidden), \
                patch.object(os, 'system', forbidden), patch.object(os, 'posix_spawn', forbidden), \
                patch.object(sys, 'argv', [str(runner), '--image', 'dummy-only-image', '--evidence-dir', directory]), \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            try:
                runpy.run_path(str(runner), run_name='__main__')
            except SystemExit as error:
                cli_exit = int(error.code or 0)
            except Exception as error:
                raised = type(error).__name__
        receipts = {p.name: json.loads(p.read_text()) for p in evidence.glob('*-run.json')}
        harnesses = [p.name for p in evidence.glob('harness-*.cjs')]
        return {'scenario': scenario, 'exit': cli_exit, 'raised': raised, 'receipts': receipts,
                'stdout': stdout.getvalue(), 'stderr': stderr.getvalue(), 'calls': calls,
                'harnesses': harnesses, 'tripwireCalls': tripwire_calls}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runner', type=pathlib.Path, default=pathlib.Path('ops/play-cookie/tests/run-cookie-fixture.py'))
    args = parser.parse_args()
    print(json.dumps([exercise(args.runner.resolve(), scenario) for scenario in SCENARIOS]))


if __name__ == '__main__':
    main()
