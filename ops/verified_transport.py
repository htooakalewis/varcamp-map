"""Dedicated urllib transport with verified TLS defaults and no redirects."""
import urllib.error
import urllib.request


class RejectRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise urllib.error.HTTPError(
            request.full_url, code, 'Redirects are disabled', headers, response)


def create_opener():
    # Retain urllib's default certificate/hostname verification; never install globally.
    return urllib.request.build_opener(RejectRedirects())
