# LAN Audio

A small local-network audio streamer. Open the source page on the computer that has the audio, choose a tab/window/screen with audio, then scan the QR code on a second device.

## Run locally

```bash
cd path/to/lan-audio
python3 server.py
```

Open the LAN URL printed by the server on the source computer. The receiver can scan the QR code or open the displayed link.

The source browser must grant screen/tab audio permission. For system-wide audio, choose a screen or window and enable Share audio when the browser offers it. Tab audio is usually the most reliable.

## GitHub Pages

The `web/` directory is static and can be published on GitHub Pages. The local Python server is still needed as the signaling/audio source agent. This first version is intended for same-Wi-Fi testing.

## Current scope

- WebRTC audio between browsers
- QR pairing
- No audio is uploaded to a third-party media server
- No automatic LAN device scanning; pairing is explicit for browser security
