"""Token-only live WAM migration: re-pin each live maps/<id>.wam to its final dist TMJ digest.

Downloads the live target through the same storage/transport as release_upload.py,
rewrites ONLY the 64-hex ``?v=`` token inside the root ``"mapUrl"`` string, and
writes the migrated WAMs into a reviewed ZIP that ``release_upload.py prepare
--reviewed-wams`` accepts. Credentials come from the environment file and are
never printed.
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys

from release_upload import Storage, read_zip, wam_reference, zip_bytes

PLACEHOLDER = b'<VERSION>'
TOKEN_LENGTH = 64


def rewrite_token(path, data, new_pin):
    """Return ``data`` with only its mapUrl version token replaced by ``new_pin``.

    Pure function. Rejects a WAM without a single literal root mapUrl token
    (missing, duplicate or malformed) and proves the output keeps every byte
    outside the token and the exact input length.
    """
    if not isinstance(new_pin, str) or not re.fullmatch('[0-9a-f]{64}', new_pin):
        raise ValueError(f'{path}: replacement pin must be 64 lowercase hex')
    old_pin, protected = wam_reference(path, data)
    # The reference scanner replaced exactly the token with PLACEHOLDER; the first
    # differing byte is therefore the token start (hex never begins with '<').
    start = next((i for i, (a, b) in enumerate(zip(data, protected)) if a != b), None)
    if start is None or protected[start:start + len(PLACEHOLDER)] != PLACEHOLDER:
        raise ValueError(f'{path}: cannot isolate a single mapUrl version token')
    end = start + TOKEN_LENGTH
    if data[start:end] != old_pin.encode('utf-8') or data[:start] != protected[:start] or data[end:] != protected[start + len(PLACEHOLDER):]:
        raise ValueError(f'{path}: mapUrl token location does not match the validated reference')
    output = data[:start] + new_pin.encode('utf-8') + data[end:]
    assert len(output) == len(data), f'{path}: migrated WAM length changed'
    assert output[:start] == data[:start] and output[end:] == data[end:], f'{path}: bytes outside the token changed'
    migrated_pin, migrated_protected = wam_reference(path, output)
    if migrated_pin != new_pin or migrated_protected != protected:
        raise ValueError(f'{path}: migrated WAM failed re-validation')
    return output


def migrate(live, dist):
    """Plan token migrations for every live WAM whose final TMJ exists under ``dist``."""
    dist = pathlib.Path(dist)
    reviewed = {}
    summary = {'migrated': [], 'unchanged': [], 'missing': []}
    for path in sorted(p for p in live if p.endswith('.wam')):
        tmj = dist / (path[:-4] + '.tmj')
        if not tmj.is_file():
            summary['missing'].append(path)
            continue
        expected_pin = hashlib.sha256(tmj.read_bytes()).hexdigest()
        current_pin, _ = wam_reference(path, live[path])
        if current_pin == expected_pin:
            summary['unchanged'].append(path)
            continue
        reviewed[path] = rewrite_token(path, live[path], expected_pin)
        summary['migrated'].append(path)
    return reviewed, summary


def main(argv=None):
    parser = argparse.ArgumentParser(description='Rewrite only the mapUrl version token of live WAMs to the final dist TMJ digests')
    parser.add_argument('--target', default='varcamp-demo')
    parser.add_argument('--environment', type=pathlib.Path, default=pathlib.Path(__file__).parent / 'private/environment')
    parser.add_argument('--dist', type=pathlib.Path, default=pathlib.Path('dist'))
    parser.add_argument('--out', required=True, type=pathlib.Path, help='reviewed WAM ZIP for release_upload.py prepare --reviewed-wams')
    args = parser.parse_args(argv)
    if not args.dist.is_dir():
        parser.error('Build the release first; dist/ is missing')
    live = read_zip(Storage(args.environment).download(args.target))
    reviewed, summary = migrate(live, args.dist)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(zip_bytes(reviewed))
    print(json.dumps({'target': args.target, 'out': str(args.out), 'liveWams': sum(p.endswith('.wam') for p in live),
                      'counts': {key: len(value) for key, value in summary.items()}, **summary}, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
