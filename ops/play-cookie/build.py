"""Build the reviewed, secret-free source overlay from its pinned ARM64 base."""
import argparse
import hashlib
import io
import json
import pathlib
import shlex
import subprocess
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument('--tag', required=True)
parser.add_argument('--host', default='devbox')
parser.add_argument('--evidence-dir', type=pathlib.Path, required=True)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent
sources = json.loads((root / 'source-files.json').read_text())
files = ['Dockerfile', 'cookie.patch', 'source-files.json'] + list(sources)
for relative, record in sources.items():
    if hashlib.sha256((root / relative).read_bytes()).hexdigest() != record['patchedSha256']:
        raise SystemExit('Source bytes differ from reviewed manifest')
context = io.BytesIO()
with tarfile.open(fileobj=context, mode='w') as archive:
    for relative in files:
        data = (root / relative).read_bytes()
        info = tarfile.TarInfo(relative)
        info.size, info.mode, info.mtime = len(data), 0o644, 0
        archive.addfile(info, io.BytesIO(data))
args.evidence_dir.mkdir(parents=True, exist_ok=True)
context_bytes = context.getvalue()
(args.evidence_dir / 'build-context.tar').write_bytes(context_bytes)
command = ['docker', 'build', '--network=none', '--pull=false', '--platform', 'linux/arm64', '--tag', args.tag, '-']
argv = ['ssh', '-o', 'BatchMode=yes', args.host, shlex.join(command)]
result = subprocess.run(argv, input=context_bytes, capture_output=True, timeout=120)
receipt = {
    'argv': argv, 'exit': result.returncode,
    'stdout': result.stdout.decode(), 'stderr': result.stderr.decode(),
    'contextSha256': hashlib.sha256(context_bytes).hexdigest(),
    'contextFiles': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in files},
}
(args.evidence_dir / 'build-run.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'exit': result.returncode, 'contextSha256': receipt['contextSha256']}))
raise SystemExit(result.returncode)
