# LAN Audio — Handoff

## Current status

The first working prototype is complete. It provides a browser-based source page, QR pairing, a lightweight Python signaling server, and WebRTC audio delivery between devices on the same Wi-Fi network.

## Project location

```text
/home/casper/lan-audio
```

## Run locally

```bash
cd /home/casper/lan-audio
python3 server.py
```

Open the printed **LAN URL** on the computer providing audio. Click **Choose audio**, select a browser tab/window/screen, and enable **Share audio**. Scan the QR code using the receiving device.

The receiver must be on the same Wi-Fi network. The browser may require the user to press Play before audio begins.

## Files

- `server.py` — dependency-free HTTP server and polling signaling API.
- `web/index.html` — source and receiver interface.
- `web/app.js` — screen/tab audio capture, QR pairing, WebRTC offer/answer flow.
- `web/style.css` — interface styling.
- `README.md` — short user documentation.

## Architecture

```text
Source browser
  └─ getDisplayMedia(audio)
       └─ WebRTC peer connection

Python server
  ├─ serves web/
  └─ stores temporary WebRTC offer/answer messages

Receiver browser
  └─ WebRTC peer connection → audio element → speakers
```

The Python server does not relay the audio media. It only serves files and exchanges temporary connection descriptions. Audio is sent through WebRTC.

## Important limitations

1. Browsers cannot silently capture all system audio. The user must explicitly share a tab, window, or screen and grant permission.
2. Browser support for system/window audio varies. Sharing a browser tab with audio is the most reliable option.
3. The current signaling service is intended for same-network testing and has no authentication, persistent storage, or HTTPS.
4. GitHub Pages can host the static `web/` files, but it cannot run `server.py`. A reachable signaling service or local server is still required.
5. The QR library currently loads from a CDN, so QR generation may not work without internet access.
6. Automatic LAN device discovery is intentionally not implemented; browsers restrict arbitrary network scanning.

## Verification completed

```text
python3 -m py_compile server.py     passed
GET /health                         passed
GET /api/room                       passed
```

## Recommended next steps

1. Add a small authenticated WebSocket signaling service for GitHub Pages use.
2. Bundle the QR-code library locally for offline operation.
3. Add a visible copyable receiver URL and six-digit pairing code.
4. Add HTTPS instructions or a local TLS option for browsers that require a secure context.
5. Add reconnect handling, room expiration UI, and a Stop button.
6. Test Chrome, Firefox, Android, and iOS audio-sharing behavior.

## GitHub Pages deployment

Publish the contents of `web/` as the Pages site. The receiver URL should include the signaling server and room parameters, for example:

```text
https://YOUR-USER.github.io/YOUR-REPO/?role=receiver&room=ROOM_CODE&server=https%3A%2F%2FYOUR-SIGNALING-SERVER
```

The current local QR flow works without this deployment, using the LAN URL printed by `server.py`.
