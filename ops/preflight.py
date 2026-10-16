"""Read-only external core checks. Safe output; no environment or token dump."""
import ipaddress
import json
import pathlib
import re
import shlex
import socket
import subprocess
import urllib.request

from preflight_checks import (
    check_reserved_ports, check_running_services, validate_image_locks,
    validate_service_image_locks, validate_local_evidence,
)

ops = pathlib.Path(__file__).parent
lock = json.load(open(ops / 'images.lock.json'))
assert lock['workadventureSource'] == '96d43a841766b22418c061744e7ed2aafd9870d3'
image_locks = validate_image_locks(lock['images'].values())
locked_references = set(image_locks)


def run(args):
    return subprocess.check_output(args, text=True).strip()


def inspect_image(reference):
    template = '{"Id":{{json .Id}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"RepoDigests":{{json .RepoDigests}}}'
    command = f'docker image inspect --format {shlex.quote(template)} {shlex.quote(reference)}'
    return json.loads(run(['ssh', 'devbox', command]))


assert run(['ssh', 'devbox', 'uname -m']) == 'aarch64'
config = json.loads(run([
    'ssh', 'devbox',
    'cd /srv/varcamp && docker compose --env-file private/environment -f compose.yml config --format json',
]))
assert config['name'] == 'varcamp'
validate_service_image_locks(config['services'], image_locks)
static = json.loads(run(['ssh', 'devbox', 'cat /srv/varcamp/private/traefik.yml']))
assert static['providers']['docker'] == {
    'exposedByDefault': False,
    'constraints': 'Label(`com.docker.compose.project`, `varcamp`)',
    'network': 'varcamp_core',
    'useBindPortIP': False,
}
images = {}
for name, service in config['services'].items():
    reference = service['image']
    assert service['platform'] == 'linux/arm64' and reference in locked_references
    images[reference] = inspect_image(reference)
    assert images[reference]['Os'] == 'linux' and images[reference]['Architecture'] == 'arm64'
    if service.get('labels', {}).get('traefik.enable') == 'true':
        assert service['labels']['traefik.docker.network'] == 'varcamp_core'
    for publication in service.get('ports', []):
        assert publication['host_ip'] == '127.0.0.1'
    if name != 'traefik':
        assert 'core' in service['networks']
assert config['networks']['core']['name'] == 'varcamp_core'
assert config['services']['traefik']['network_mode'] == 'host'
assert config['services']['play']['environment']['MAP_EDITOR_ALLOW_ALL_USERS'] == 'false'
assert config['services']['play']['environment']['OPENID_TAGS_CLAIM'] == 'tags'

networks = json.loads(run(['ssh', 'devbox', 'docker network inspect $(docker network ls -q)']))
core = ipaddress.ip_network('10.203.1.0/24')
media = ipaddress.ip_network('10.203.0.0/24')
for network in networks:
    for allocation in network.get('IPAM', {}).get('Config') or []:
        if 'Subnet' in allocation and network['Name'] != 'varcamp_core':
            subnet = ipaddress.ip_network(allocation['Subnet'])
            assert not core.overlaps(subnet) and not media.overlaps(subnet)
check_reserved_ports(run(['ssh', 'devbox', 'ss -H -lntu']))

# Inspect only nonsecret identity/image/health fields, never container environment/logs.
container_template = (
    '{"Image":{{json .Image}},"Config":{"Image":{{json .Config.Image}},"Labels":{'
    '"com.docker.compose.project":{{json (index .Config.Labels "com.docker.compose.project")}},'
    '"com.docker.compose.service":{{json (index .Config.Labels "com.docker.compose.service")}}}},'
    '"State":{"Running":{{json .State.Running}},"Health":{"Status":'
    '{{if .State.Health}}{{json .State.Health.Status}}{{else}}"healthy"{{end}}}}}'
)
command = (
    'docker inspect $(docker ps -q --filter label=com.docker.compose.project=varcamp) '
    f'--format {shlex.quote(container_template)}'
)
containers = [json.loads(line) for line in run(['ssh', 'devbox', command]).splitlines()]
for image_id in {container['Image'] for container in containers}:
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', image_id):
        raise ValueError('Invalid actual container image ID')
    images[image_id] = inspect_image(image_id)
# Acquire the actual retained bytes on the deployment host. This never loads, pulls or builds.
local_evidence = {}
for reference, image_lock in image_locks.items():
    if image_lock.get('identityMode') != 'local-artifact-v1':
        continue
    source = (ops / 'preflight_checks.py').read_text()
    source += '\nlocal_lock = ' + repr(image_lock) + '\n'
    source += "print(json.dumps(acquire_local_evidence('/srv/varcamp', local_lock)))\n"
    evidence = json.loads(subprocess.check_output(
        ['ssh', 'devbox', 'python3 -'], input=source, text=True,
    ))
    validate_local_evidence(image_lock, evidence)
    local_evidence[reference] = evidence
check_running_services(
    config['services'], containers, images,
    image_locks=image_locks, local_evidence=local_evidence,
)

for name in ['varcamp', 'maps', 'icons', 'livekit', 'id', 'turn-livekit', 'turn-p2p']:
    host = name + '.3-1-133-135.sslip.io'
    assert '3.1.133.135' in socket.gethostbyname_ex(host)[2]
for port in [80, 443]:
    with socket.create_connection(('3.1.133.135', port), timeout=5):
        pass
for host, path in [
    ('varcamp', '/'), ('maps', '/maps'), ('icons', '/'),
    ('id', '/realms/varcamp/.well-known/openid-configuration'),
]:
    with urllib.request.urlopen('https://' + host + '.3-1-133-135.sslip.io' + path, timeout=20) as response:
        assert response.status == 200
print(
    'CORE CHECKS PASS: exact running service/image/ARM64 pins, private ports/network, '
    'reserved media sockets including TCP7880, all DNS, external80/443 and trusted '
    'HTTPS core/identity. Full media readiness remains unverified.'
)
