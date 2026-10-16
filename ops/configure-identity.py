"""Apply protected profile permissions via trusted HTTPS, without printing tokens."""
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

from verified_transport import create_opener

opener = create_opener()


def call(base, path, method='GET', data=None, token=None):
    headers = {}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if isinstance(data, dict):
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    elif data is not None:
        body = urllib.parse.urlencode(data).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    else:
        body = None
    request = urllib.request.Request(base + path, data=body, headers=headers, method=method)
    with opener.open(request, timeout=20) as response:
        text = response.read()
        return json.loads(text) if text else None


def main():
    ops = pathlib.Path(__file__).resolve().parent
    env = dict(line.split('=', 1) for line in (ops / 'private/environment').read_text().splitlines())
    base = 'https://' + env['ID_HOST']
    # Use form list so no password appears in arguments/output.
    token = call(base, '/realms/master/protocol/openid-connect/token', 'POST', [
        ('grant_type', 'password'), ('client_id', 'admin-cli'),
        ('username', 'bootstrap-admin'), ('password', env['BOOTSTRAP_ADMIN_PASSWORD']),
    ])['access_token']
    path = '/admin/realms/varcamp/users/profile'
    profile = call(base, path, token=token)
    profile.pop('unmanagedAttributePolicy', None)  # null/omitted disables unmanaged attributes in26.8.0
    for attribute in profile['attributes']:
        if attribute['name'] == 'email':
            attribute.setdefault('permissions', {})['edit'] = ['admin']
    profile['attributes'] = [item for item in profile['attributes'] if item['name'] != 'wa_tags'] + [{
        'name': 'wa_tags', 'multivalued': True,
        'permissions': {'view': ['admin'], 'edit': ['admin']},
        'validations': {'options': {'options': ['organizer', 'speaker']}},
    }]
    try:
        call(base, path, 'PUT', profile, token)
    except urllib.error.HTTPError as error:
        message = error.read().decode()
        for key, value in env.items():
            if any(part in key for part in ['EMAIL', 'SECRET', 'PASSWORD', 'TOKEN']):
                message = message.replace(value, '[redacted]')
        raise SystemExit('Profile request rejected: ' + message)
    verified = call(base, path, token=token)
    assert verified.get('unmanagedAttributePolicy') is None
    assert next(item for item in verified['attributes'] if item['name'] == 'wa_tags')['permissions']['edit'] == ['admin']
    assert next(item for item in verified['attributes'] if item['name'] == 'email')['permissions']['edit'] == ['admin']
    users = call(base, '/admin/realms/varcamp/users?username=organiser&exact=true', token=token)
    assert len(users) == 1 and users[0]['attributes']['wa_tags'] == ['organizer']
    print('Protected email and wa_tags profile applied; only supplied organiser has organizer claim. Direct grants remain disabled.')


if __name__ == '__main__':
    main()
