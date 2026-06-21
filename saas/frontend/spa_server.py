from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "index.html"


class SpaHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        translated = Path(super().translate_path(path))
        try:
            translated.relative_to(ROOT)
        except ValueError:
            return str(INDEX)
        return str(translated)

    def do_GET(self) -> None:
        requested = ROOT / self.path.lstrip("/").split("?", 1)[0]
        if self.path.startswith("/assets/") or requested.exists():
            return super().do_GET()
        self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 80), SpaHandler)
    server.serve_forever()
