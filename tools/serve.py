"""Локальный сервер для проверки сайта без кэширования: py tools/serve.py [порт]
POST /save/<имя>.json сохраняет тело запроса в tools/out/ (нужно для tools/server_check.py)."""
import functools
import http.server
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tools" / "out"


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        m = re.fullmatch(r"/save/((?:[\w-]+/)?[\w.-]+\.json)", self.path)
        if not m:
            self.send_error(404)
            return
        target = OUT / m.group(1)
        target.parent.mkdir(parents=True, exist_ok=True)
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        target.write_bytes(body)
        self.send_response(204)
        self.end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(NoCache, directory=str(ROOT))).serve_forever()
