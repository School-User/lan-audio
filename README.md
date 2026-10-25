# LAN Audio

Send the audio from a browser tab to other devices on the same Wi-Fi. Play YouTube, Spotify, or anything else in a Chrome tab on your computer, then listen on your phone, tablet, or smart display, with one link for all of them.

Audio goes directly between browsers over WebRTC. The server only passes connection setup messages, and it has no dependencies beyond Python 3.

## Requirements

- Python 3 on the computer that has the audio (the source)
- Google Chrome on the source. Firefox usually can't share tab audio on Linux.
- Every receiving device on the same Wi-Fi network as the source
- Internet access on the source, which loads the QR code library

## Run it

```bash
cd path/to/lan-audio
python3 server.py
```

The server listens on port 8080. To use another port, run `python3 server.py --port 9000`. Leave the terminal open while you share.

If your firewall is on (for example, `ufw`), allow the port for your local network only:

```bash
sudo ufw allow from 192.168.0.0/16 to any port 8080 proto tcp
```

Adjust the range to match your network.

## Share audio

1. On the source computer, open **http://127.0.0.1:8080/** in Chrome. Use `127.0.0.1`, not the LAN address. Browsers only allow audio capture on that address.
2. Start playback in another tab, such as YouTube or Spotify on the web.
3. Click **Choose audio**, select that tab, turn on **Share tab audio**, and click **Share**.
4. Copy the receiver link shown under the QR code, or scan the QR code with a phone.

## Listen on a receiver

Open the receiver link in any browser on the same Wi-Fi. Each device gets its own connection, so several devices can listen at once. If the page says to tap play, tap the play button. Safari and some tablets block audio until you tap.

The link is tied to the room the source page created. If you reload the source page, it creates a new room and a new link, so open the new link on each device.

## Stopping and restarting

- Click **Stop sharing** in Chrome's sharing bar, or stop the tab's audio. The source page reports that sharing has stopped.
- Click **Choose audio** again to share another tab.
- Receivers that lose their connection reconnect automatically.

## Limits

- **Local network only.** The server has no login. Anyone on your Wi-Fi who can reach the port can use it, so don't forward the port to the internet.
- **Source must be Chrome** for tab audio. Other browsers may only share a screen or window, and that may not include audio.
- **Devices play at their own speed.** With several receivers, the audio can drift slightly apart, which sounds like an echo. There's no per-device delay correction yet.
- **Rooms expire after one hour**, so start a new share if the link stops working.

## Files

- `server.py` — HTTP server and signaling for the connection setup
- `web/index.html`, `web/app.js`, `web/style.css` — the source and receiver pages
- `handoff.md` — project notes and history
