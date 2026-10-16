"""One-time retirement after permanent organiser realm administration is UI-verified."""
import json
import pathlib
import urllib.parse
import urllib.request

from verified_transport import create_opener

opener = create_opener()


def main():
    ops = pathlib.Path(__file__).resolve().parent
    env = dict(line.split('=', 1) for line in (ops / 'private/environment').read_text().splitlines())
    base = 'https://' + env['ID_HOST']
    body = urllib.parse.urlencode({
        'grant_type': 'password', 'client_id': 'admin-cli',
        'username': 'bootstrap-admin', 'password': env['BOOTSTRAP_ADMIN_PASSWORD'],
    }).encode()
    request = urllib.request.Request(base + '/realms/master/protocol/openid-connect/token', data=body)
    with opener.open(request, timeout=20) as response:
        token = json.load(response)['access_token']
    headers = {'Authorization': 'Bearer ' + token}
    request = urllib.request.Request(
        base + '/admin/realms/master/users?username=bootstrap-admin&exact=true', headers=headers)
    with opener.open(request, timeout=20) as response:
        users = json.load(response)
    assert len(users) == 1
    request = urllib.request.Request(
        base + '/admin/realms/master/users/' + users[0]['id'], headers=headers, method='DELETE')
    with opener.open(request, timeout=20) as response:
        assert response.status == 204
    print('Temporary bootstrap account deleted HTTP204.')


if __name__ == '__main__':
    main()
