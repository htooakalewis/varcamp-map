"""Exercise real checks with deterministic inventory, without network or secret inputs."""
import copy
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[2]
reference = 'example/workadventure@sha256:' + '1' * 64
image_id = 'sha256:' + '2' * 64
services = {'play': {'image': reference}, 'back': {'image': reference}}
metadata = {'Id': image_id, 'Os': 'linux', 'Architecture': 'arm64', 'RepoDigests': [reference]}
images = {reference: metadata, image_id: copy.deepcopy(metadata)}
containers = [
    {'Image': image_id, 'Config': {'Image': reference, 'Labels': {
        'com.docker.compose.project': 'varcamp', 'com.docker.compose.service': service}},
     'State': {'Running': True, 'Health': {'Status': 'healthy'}}}
    for service in services
]
sockets = 'tcp LISTEN 0 4096 127.0.0.1:40131 0.0.0.0:*\n'
case = sys.argv[1]
if case == 'occupied-loopback':
    sockets += 'tcp LISTEN 0 4096 127.0.0.1:7880 0.0.0.0:*\n'
elif case in {'stale-image', 'wrong-image-id'}:
    old_id = 'sha256:' + '3' * 64
    old_reference = 'example/workadventure@sha256:' + '4' * 64
    containers[0]['Image'] = old_id
    images[old_id] = {**metadata, 'Id': old_id, 'RepoDigests': [old_reference]}
    if case == 'stale-image':
        # Config/cache has the new pin; this healthy service was never recreated.
        containers[0]['Config']['Image'] = old_reference
elif case == 'wrong-service':
    containers[1]['Config']['Labels']['com.docker.compose.service'] = 'unexpected-worker'
elif case == 'duplicate-service':
    containers[1]['Config']['Labels']['com.docker.compose.service'] = 'play'
elif case == 'missing-service':
    containers.pop()
elif case == 'unlocked-reference':
    containers[0]['Config']['Image'] = 'example/workadventure:latest'
elif case == 'wrong-architecture':
    images[image_id]['Architecture'] = 'amd64'
elif case == 'udp-7880':
    sockets += 'udp UNCONN 0 0 127.0.0.1:7880 0.0.0.0:*\n'
elif case != 'valid':
    raise SystemExit('Unknown fixture')

try:
    sys.path.insert(0, str(root / 'ops'))
    from preflight_checks import check_reserved_ports, check_running_services
    check_reserved_ports(sockets)
    check_running_services(services, containers, images)
    result = {'case': case, 'accepted': True}
except (AssertionError, ValueError, KeyError) as error:
    result = {'case': case, 'accepted': False, 'reason': str(error)}
print(json.dumps(result))
