from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
API_UPSTREAM = "http://127.0.0.1:8000"


class SpaHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def translate_path(self, path):
        translated = Path(super().translate_path(path))
        try:
            translated.relative_to(ROOT)
        except ValueError:
            return str(ROOT / "index.html")
        if translated.exists() or path.startswith("/assets/"):
            return str(translated)
        return str(ROOT / "index.html")

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.proxy_api()
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self.proxy_api()
            return
        super().do_POST()

    def do_PATCH(self):
        if self.path.startswith("/api/"):
            self.proxy_api()
            return
        self.send_error(405, "Method not allowed")

    def do_DELETE(self):
        if self.path.startswith("/api/"):
            self.proxy_api()
            return
        self.send_error(405, "Method not allowed")

    def proxy_api(self):
        target = f"{API_UPSTREAM}{self.path}"
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length else None
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in {"host", "connection", "content-length"}
        }
        request = Request(target, data=body, headers=headers, method=self.command)
        if body is not None:
            request.add_header("Content-Length", str(len(body)))
        try:
            with urlopen(request, timeout=None) as response:
                response_body = response.read()
                self.send_response(response.status)
                for key, value in response.headers.items():
                    if key.lower() in {"connection", "transfer-encoding", "content-length"}:
                        continue
                    self.send_header(key, value)
                self.send_header("Content-Length", str(len(response_body)))
                self.end_headers()
                self.wfile.write(response_body)
        except HTTPError as error:
            response_body = error.read()
            self.send_response(error.code)
            for key, value in error.headers.items():
                if key.lower() in {"connection", "transfer-encoding", "content-length"}:
                    continue
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)
        except URLError as error:
            payload = f'{{"detail":"API upstream unavailable: {error.reason}"}}'.encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 80), SpaHandler)
    server.serve_forever()
