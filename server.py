#!/usr/bin/env python3
"""Tiny dependency-free HTTP server and polling signaling service for LAN Audio."""
from __future__ import annotations
import json
import secrets
import socket
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).parent
WEB = ROOT / "web"
ROOMS: dict[str, dict[str, object]] = {}
ROOM_TTL = 3600

def local_ip() -> str:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    except OSError:
        return "127.0.0.1"
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()

def clean_rooms() -> None:
    cutoff = time.time() - ROOM_TTL
    for room, state in list(ROOMS.items()):
        if float(state.get("created", 0)) < cutoff:
            ROOMS.pop(room, None)

class Handler(BaseHTTPRequestHandler):
    server_version = "LANAudio/0.1"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[{self.address_string()}] {fmt % args}")

    def send_json(self, value: object, status: int = 200) -> None:
        payload = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def body(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self) -> None:  # noqa: N802
        clean_rooms()
        parsed = urlparse(self.path)
        if parsed.path == "/api/room":
            room = secrets.token_urlsafe(8)
            ROOMS[room] = {"created": time.time(), "receivers": {}}
            self.send_json({"room": room, "lan": f"http://{local_ip()}:{self.server.server_address[1]}"})
            return
        if parsed.path == "/api/state":
            room = parse_qs(parsed.query).get("room", [""])[0]
            state = ROOMS.get(room)
            if state is None:
                self.send_json({"error": "unknown room"}, 404)
                return
            self.send_json({"receivers": state["receivers"]})
            return
        if parsed.path == "/health":
            self.send_json({"ok": True})
            return
        self.serve_file(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        data = self.body()
        state = ROOMS.get(str(data.get("room", "")))
        if state is None:
            self.send_json({"error": "unknown room"}, 404)
            return
        if parsed.path == "/api/join":
            state["receivers"].pop(str(data.get("previous", "")), None)  # a rejoin replaces the old ID
            receiver_id = secrets.token_urlsafe(6)
            state["receivers"][receiver_id] = {}
            self.send_json({"id": receiver_id})
            return
        receiver = state["receivers"].get(str(data.get("id", "")))
        description = data.get("description")
        if parsed.path not in {"/api/offer", "/api/answer"} or receiver is None or not isinstance(description, dict):
            self.send_json({"error": "bad request"}, 400)
            return
        receiver["offer" if parsed.path.endswith("offer") else "answer"] = description
        self.send_json({"ok": True})

    def serve_file(self, path: str) -> None:
        relative = "index.html" if path in {"", "/"} else path.lstrip("/")
        candidate = (WEB / relative).resolve()
        if WEB not in candidate.parents or not candidate.is_file():
            self.send_error(404)
            return
        content = candidate.read_bytes()
        content_type = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8"}.get(candidate.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="LAN Audio server")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    print(f"Local URL: http://127.0.0.1:{args.port}/")
    print(f"LAN URL:   http://{local_ip()}:{args.port}/")
    print("Open the LAN URL on the audio source computer, then scan its QR code.")
    ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()
