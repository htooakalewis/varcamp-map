"""Bounded real-source suite; image must already exist. No pull/build/load/secrets."""
import argparse
import base64
import datetime
import hashlib
import json
import pathlib
import shlex
import subprocess
import uuid

MODES = ['configured-https', 'configured-http', 'native-tls', 'empty', 'relative']


def output_text(value):
    # TimeoutExpired can expose bytes even when the subprocess requested text.
    return value.decode('utf-8', errors='replace') if isinstance(value, bytes) else value or ''


def command_outcome(stage, argv, timeout, **kwargs):
    outcome = {'stage': stage, 'argv': argv, 'timeout': timeout, 'exit': None,
               'stdout': '', 'stderr': '', 'timedOut': False}
    try:
        result = subprocess.run(argv, text=True, capture_output=True, timeout=timeout, **kwargs)
        outcome.update(exit=result.returncode, stdout=result.stdout, stderr=result.stderr)
    except subprocess.TimeoutExpired as error:
        outcome.update(timedOut=True, stdout=output_text(error.stdout), stderr=output_text(error.stderr))
    except OSError as error:
        # Retain the category without an exception message that may contain arguments.
        outcome['errorType'] = type(error).__name__
    return outcome


def ssh_command(command):
    return ['ssh', '-o', 'BatchMode=yes', 'devbox', shlex.join(command)]


def cleanup_fixture(name):
    probe = ssh_command(['docker', 'ps', '-aq', '--filter', 'name=^/' + name + '$'])
    first = command_outcome('first-probe', probe, 20)
    commands = [first]
    forced = first['exit'] == 0 and bool(first['stdout'].strip())
    if forced:
        commands.append(command_outcome('remove', ssh_command(['docker', 'rm', '-f', name]), 20))
    final = command_outcome('final-probe', probe, 20)
    commands.append(final)
    known = all(command['exit'] == 0 for command in commands)
    remaining = len(final['stdout'].split()) if known else None
    return {'cleanup': commands, 'forcedCleanup': forced, 'remaining': remaining,
            'cleanupSucceeded': known and remaining == 0}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True)
    parser.add_argument('--evidence-dir', type=pathlib.Path, required=True)
    args = parser.parse_args()
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    script = pathlib.Path(__file__).with_name('cookie-fixture.cjs').read_text()
    harness_hash = hashlib.sha256(script.encode()).hexdigest()
    (args.evidence_dir / ('harness-' + harness_hash + '.cjs')).write_text(script)
    # Caller supplies temporary synthetic TLS key/cert; no runtime/private material.
    key = (args.evidence_dir / 'fixture-tls.key').read_bytes()
    cert = (args.evidence_dir / 'fixture-tls.crt').read_bytes()
    for mode in MODES:
        name = 'varcamp-h2-cookie-fixture-' + uuid.uuid4().hex[:12]
        env = {'FIXTURE_MODE': mode}
        if mode == 'native-tls':
            env.update(FIXTURE_TLS_KEY=base64.b64encode(key).decode(),
                       FIXTURE_TLS_CERT=base64.b64encode(cert).decode())
        docker = ['docker', 'run', '--rm', '-i', '--name', name, '--pull=never',
                  '--network=none', '--read-only', '--tmpfs',
                  '/tmp:rw,noexec,nosuid,size=32m,uid=1000,gid=1000', '--cap-drop=ALL',
                  '--security-opt=no-new-privileges', '--memory=512m', '--cpus=1',
                  '--pids-limit=64', '--user', '1000:1000', '--workdir', '/usr/src/play',
                  '--entrypoint', 'node']
        for key_name, value in env.items():
            docker.extend(['--env', key_name + '=' + value])
        docker.extend([args.image, '-'])
        run = command_outcome('run', ssh_command(docker), 65, input=script)
        cleanup = cleanup_fixture(name)
        receipt = {'mode': mode, 'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'harnessSha256': harness_hash, **run, **cleanup}
        (args.evidence_dir / (mode + '-run.json')).write_text(json.dumps(receipt, indent=2) + '\n')
        summary = {field: receipt[field] for field in ['mode', 'exit', 'stdout', 'stderr',
                                                      'timedOut', 'remaining', 'cleanupSucceeded', 'cleanup']}
        print(json.dumps(summary), flush=True)
        # Unknown outcomes (including timeouts) cannot certify absence or start another mode.
        if run['exit'] != 0 or not cleanup['cleanupSucceeded']:
            return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
