"""Run the actual helper flows with dummy inputs and protocol-only I/O doubles.

urllib's request, response, redirect processing and selected opener remain real.
No sockets, private-file reads, TLS overrides or privileged traffic occur.
"""
import contextlib
import io
import json
import pathlib
import runpy
import sys
import urllib.error
import urllib.request
import urllib.response
from email.message import Message
from unittest.mock import patch

OPS = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS))
PROFILE = {'attributes': [
    {'name': 'email', 'permissions': {'edit': ['admin']}},
    {'name': 'wa_tags', 'permissions': {'edit': ['admin']}},
]}
FLOWS = {
    'configure-identity': [
        ('POST', '/realms/master/protocol/openid-connect/token', {'access_token': 'dummy-only'}),
        ('GET', '/admin/realms/varcamp/users/profile', PROFILE),
        ('PUT', '/admin/realms/varcamp/users/profile', None),
        ('GET', '/admin/realms/varcamp/users/profile', PROFILE),
        ('GET', '/admin/realms/varcamp/users?username=organiser&exact=true',
         [{'attributes': {'wa_tags': ['organizer']}}]),
    ],
    'retire-bootstrap': [
        ('POST', '/realms/master/protocol/openid-connect/token', {'access_token': 'dummy-only'}),
        ('GET', '/admin/realms/master/users?username=bootstrap-admin&exact=true', [{'id': 'dummy-id'}]),
        ('DELETE', '/admin/realms/master/users/dummy-id', None),
    ],
}


def exercise(helper, attack_index=None, location=None, code=200):
    requests, openers = [], []
    next_step, redirected = 0, False

    class DummyTransport(urllib.request.BaseHandler):
        handler_order = 100

        def https_open(self, request):
            nonlocal next_step, redirected
            requests.append({
                'url': request.full_url,
                'method': request.get_method(),
                'authorizationPresent': request.get_header('Authorization') is not None,
                'passwordPresent': b'password=dummy-only' in (request.data or b''),
            })
            headers = Message()
            if next_step == attack_index and not redirected:
                headers['Location'] = location
                status, payload = code, b''
                redirected = True
            else:
                expected_method, expected_path, value = FLOWS[helper][next_step]
                if not redirected:
                    assert request.get_method() == expected_method
                    assert request.full_url == 'https://trusted.example' + expected_path
                status = 204 if expected_method == 'DELETE' else 200
                payload = json.dumps(value).encode() if value is not None else b''
                next_step += 1
            response = urllib.response.addinfourl(io.BytesIO(payload), headers, request.full_url, status)
            response.msg = 'controlled response'
            return response

        http_open = https_open

    real_build_opener = urllib.request.build_opener

    def with_dummy_transport(*handlers):
        opener = real_build_opener(*handlers, DummyTransport())
        openers.append(opener)
        return opener

    def dummy_environment(path, *args, **kwargs):
        assert path == OPS / 'private/environment', 'Unexpected file read'
        return 'ID_HOST=trusted.example\nBOOTSTRAP_ADMIN_PASSWORD=dummy-only\n'

    with patch.object(pathlib.Path, 'read_text', dummy_environment), \
            patch.object(urllib.request, 'build_opener', with_dummy_transport), \
            patch.object(urllib.request, '_opener', None), contextlib.redirect_stdout(io.StringIO()):
        try:
            runpy.run_path(str(OPS / (helper + '.py')), run_name='__main__')
            outcome = {'rejected': False, 'completed': next_step == len(FLOWS[helper])}
        except urllib.error.HTTPError as error:
            outcome = {'rejected': True, 'status': error.code, 'completed': False}
            error.close()
        except SystemExit as error:
            # configure's existing PUT-error redaction converts HTTPError to SystemExit.
            assert helper == 'configure-identity' and attack_index == 2
            assert str(error).startswith('Profile request rejected:')
            cause = error.__context__
            assert isinstance(cause, urllib.error.HTTPError)
            outcome = {'rejected': True, 'status': cause.code, 'completed': False}
        verified_tls = bool(openers) and all(
            any(isinstance(handler, urllib.request.HTTPSHandler) and handler._context is None
                for handler in opener.handlers) for opener in openers)
        global_opener_untouched = urllib.request._opener is None
    return {'helper': helper, 'attackIndex': attack_index, 'location': location, 'code': code,
            'requests': requests, 'verifiedTlsDefaults': verified_tls,
            'globalOpenerUntouched': global_opener_untouched, **outcome}


def import_safety(helper):
    with patch.object(pathlib.Path, 'read_text', side_effect=AssertionError('private read at import')), \
            patch.object(urllib.request, 'urlopen', side_effect=AssertionError('request at import')), \
            patch.object(urllib.request.OpenerDirector, 'open', side_effect=AssertionError('request at import')):
        try:
            runpy.run_path(str(OPS / (helper + '.py')), run_name='import_only')
            return {'helper': helper, 'safe': True}
        except AssertionError:
            return {'helper': helper, 'safe': False}


if __name__ == '__main__':
    locations = ['https://other.example/redirected', 'http://trusted.example/redirected',
                 'https://trusted.example/redirected']
    print(json.dumps({
        'redirects': [exercise(helper, step, location, code)
                      for helper, flow in FLOWS.items() for step in range(len(flow))
                      for location in locations for code in [301, 302, 303, 307, 308]],
        'ordinary': [exercise(helper) for helper in FLOWS],
        'imports': [import_safety(helper) for helper in FLOWS],
    }))
