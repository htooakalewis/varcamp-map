"""Execute production lock/service validators for nonsecret rendered test config."""
import json
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from preflight_checks import validate_image_locks, validate_service_image_locks
payload = json.load(sys.stdin)
try:
    locks = validate_image_locks(payload['entries'])
    validate_service_image_locks(payload['services'], locks)
    result = {'accepted': True}
except (ValueError, KeyError, TypeError):
    result = {'accepted': False}
print(json.dumps(result))
