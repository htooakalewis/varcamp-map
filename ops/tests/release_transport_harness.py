"""Exercise Storage's selected urllib opener; only protocol I/O is simulated.

No sockets, TLS overrides or real credentials. Standard request processing,
redirect handlers, response processing and the project's transport remain real.
"""
import io
import json
import pathlib
import sys
import tempfile
import urllib.error
import urllib.request
import urllib.response
from email.message import Message
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from release_upload import Storage


def exercise(location, code, method):
    requests = []

    class DummyTransport(urllib.request.BaseHandler):
        handler_order = 100

        def https_open(self, request):
            requests.append({
                'url': request.full_url,
                'method': request.get_method(),
                'dummyAuthorizationPresent': request.get_header('Authorization') is not None,
                'hostHeaderPresent': request.get_header('X-map-storage-host') is not None,
            })
            headers = Message()
            status = code if location and len(requests) == 1 else 200
            if status != 200:
                headers['Location'] = location
            response = urllib.response.addinfourl(io.BytesIO(b'ordinary response'), headers, request.full_url, status)
            response.msg = 'controlled response'
            return response

        http_open = https_open

    real_build_opener = urllib.request.build_opener

    def with_dummy_transport(*handlers):
        return real_build_opener(*handlers, DummyTransport())

    with tempfile.TemporaryDirectory() as directory:
        environment = pathlib.Path(directory) / 'environment'
        environment.write_text('MAPS_HOST=trusted.example\nUPLOAD_USER=dummy\nUPLOAD_PASSWORD=dummy-only\n')
        with patch.object(urllib.request, 'build_opener', with_dummy_transport), patch.object(urllib.request, '_opener', None):
            storage = Storage(environment)
            try:
                status, body = storage.request('/download' if method == 'GET' else '/upload', method, b'dummy-payload' if method == 'POST' else None)
                outcome = {'rejected': False, 'status': status, 'body': body.decode()}
            except urllib.error.HTTPError as error:
                outcome = {'rejected': True, 'status': error.code}
                error.close()
    return {'location': location, 'code': code, 'method': method, 'requests': requests, **outcome}


if __name__ == '__main__':
    locations = ['https://other.example/redirected', 'http://trusted.example/redirected', 'https://trusted.example/redirected']
    redirects = [exercise(location, code, method) for location in locations for code in [301, 302, 303, 307, 308] for method in ['GET', 'POST']]
    print(json.dumps({'redirects': redirects, 'ordinary': [exercise(None, 200, method) for method in ['GET', 'POST']]}))
