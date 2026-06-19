"""Tiny local server for the Xenoblade Utility Tracker.

Serves the static web/ frontend and a minimal JSON progress API:
    GET  /api/state  -> current data/progress.json (user's checkmarks)
    POST /api/state  -> overwrite data/progress.json (a .bak copy is kept)

The per-game catalogs (read-only reference data) live in web/data/<game>.json
and are served as ordinary static files; they are produced by app/seed/.

Run:
    python app/server.py
Then open http://localhost:12310 in your browser.
"""
import json
import os
import shutil
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data")
PROGRESS = os.path.join(DATA_DIR, "progress.json")
PORT = 12310

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # quiet

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/state":
            try:
                with open(PROGRESS, encoding="utf-8") as f:
                    self._send(200, f.read())
            except FileNotFoundError:
                # No progress yet: hand back an empty document so the app starts clean.
                self._send(200, json.dumps({"version": 1, "games": {}}))
            return

        # static files (web/), including web/data/<game>.json catalogs
        if path == "/":
            path = "/index.html"
        target = os.path.normpath(os.path.join(WEB, path.lstrip("/")))
        if not target.startswith(WEB) or not os.path.isfile(target):
            self._send(404, "Not found", "text/plain; charset=utf-8")
            return
        ext = os.path.splitext(target)[1]
        with open(target, "rb") as f:
            self._send(200, f.read(), CONTENT_TYPES.get(ext, "application/octet-stream"))

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        if path != "/api/state":
            self._send(404, json.dumps({"error": "unknown endpoint"}))
            return
        try:
            parsed = json.loads(raw)  # validate
        except json.JSONDecodeError as e:
            self._send(400, json.dumps({"error": f"invalid JSON: {e}"}))
            return
        os.makedirs(DATA_DIR, exist_ok=True)
        if os.path.isfile(PROGRESS):
            shutil.copy2(PROGRESS, PROGRESS + ".bak")
        with open(PROGRESS, "w", encoding="utf-8") as f:
            json.dump(parsed, f, ensure_ascii=False, indent=2)
        self._send(200, json.dumps({"ok": True}))


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://localhost:{PORT}"
    print(f"Xenoblade Utility Tracker running at {url}")
    print("Press Ctrl+C to stop.")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
