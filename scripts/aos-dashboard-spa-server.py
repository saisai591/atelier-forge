from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class SpaHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        translated = Path(super().translate_path(path))
        try:
            translated.relative_to(ROOT)
        except ValueError:
            return str(ROOT / "index.html")
        if translated.exists() or path.startswith("/assets/"):
            return str(translated)
        return str(ROOT / "index.html")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 80), SpaHandler)
    server.serve_forever()
