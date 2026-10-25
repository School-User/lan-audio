const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search), role = params.get('role') || (params.get('room') ? 'receiver' : 'source');
const roomFromUrl = params.get('room'), serverFromUrl = params.get('server');
let server = serverFromUrl || location.origin, room, stream, timer, busy = false;
const peers = new Map(); // source side: receiver id -> RTCPeerConnection
const say = message => $('status').textContent = message;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(path, options = {}) { const response = await fetch(`${server}${path}`, { cache: 'no-store', ...options, headers: {'Content-Type': 'application/json', ...(options.headers || {})} }); if (!response.ok) throw new Error(await response.text()); return response.json(); }
// Wait for ICE gathering, but at most 3 seconds: a slow or unreachable STUN server would otherwise hang forever.
async function waitForIce(pc) {
  if (pc.iceGatheringState === 'complete') return;
  const complete = new Promise(resolve => {
    const check = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', check); resolve(); } };
    pc.addEventListener('icegatheringstatechange', check);
  });
  await Promise.race([complete, sleep(3000)]);
}
function newPeer(onState) { const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); pc.onconnectionstatechange = () => onState(pc.connectionState); return pc; }

// Creates the room and shows the receiver link and QR code before any audio is shared.
async function showReceiverLink() {
  const info = await api('/api/room'); room = info.room;
  const lanBase = info.lan || location.origin;
  const receiverUrl = `${lanBase}/?room=${encodeURIComponent(room)}`;
  $('qr').hidden = false; $('pairing').hidden = false; $('qr').innerHTML = '';
  new QRCode($('qr'), { text: receiverUrl, width: 220, height: 220, colorDark: '#151515', colorLight: '#ffffff' });
  $('pairing').textContent = `Or open this on any receiver: ${receiverUrl}`;
}

function updateSourceStatus() {
  const connected = [...peers.values()].filter(pc => pc.connectionState === 'connected').length;
  say(`Sharing. ${connected} of ${peers.size} receiver(s) connected.`);
}

// Offers the shared audio to one receiver.
async function offerTo(id) {
  const pc = newPeer(() => updateSourceStatus()); peers.set(id, pc);
  stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));
  try {
    await pc.setLocalDescription(await pc.createOffer()); await waitForIce(pc);
    await api('/api/offer', { method: 'POST', body: JSON.stringify({ room, id, description: pc.localDescription }) });
  } catch (error) {
    pc.close(); peers.delete(id); // drop it so the next sync offers again
    throw error;
  }
}

// Runs every second: offers to new receivers and applies answers from receivers that already have an offer.
async function syncReceivers() {
  if (busy) return;
  busy = true;
  try {
    const { receivers } = await api(`/api/state?room=${encodeURIComponent(room)}`);
    for (const [id, pc] of [...peers]) {
      if (!receivers[id]) { pc.close(); peers.delete(id); } // receiver rejoined or left
    }
    for (const [id, data] of Object.entries(receivers)) {
      if (!peers.has(id)) await offerTo(id);
      const pc = peers.get(id);
      if (data.answer && !pc.currentRemoteDescription) await pc.setRemoteDescription(data.answer);
    }
    updateSourceStatus();
  } finally {
    busy = false;
  }
}

async function startSource() {
  $('startButton').disabled = true;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    stream.getVideoTracks().forEach(track => track.stop()); if (!stream.getAudioTracks().length) throw new Error('No audio track was shared. Try a browser tab or enable Share audio.');
    if (!room) await showReceiverLink();
    say('Sharing. Waiting for receivers…');
    // The browser's own "Stop sharing" control ends the track; stop polling and let the user share again.
    stream.getAudioTracks()[0].onended = () => { clearInterval(timer); $('startButton').disabled = false; say('Sharing stopped. Click Choose audio to share again.'); };
    clearInterval(timer);
    timer = setInterval(() => syncReceivers().catch(error => say(error.message)), 1000);
  } catch (error) { $('startButton').disabled = false; say(error.message); }
}

// Receiver side: join the room with a fresh ID, answer the offer, and rejoin if the connection drops.
async function joinAsReceiver(previousId) {
  const { id } = await api('/api/join', { method: 'POST', body: JSON.stringify({ room, previous: previousId }) });
  say('Waiting for source…');
  let rejoinTimer;
  const pc = newPeer(state => {
    // Safari and some tablets block audio until the user taps play, so say so once connected.
    say(state === 'connected' && $('player').paused ? 'Connected. Tap ▶ to start audio.' : `Connection: ${state}`);
    clearTimeout(rejoinTimer);
    if (state === 'failed') rejoinNow();
    if (state === 'disconnected') rejoinTimer = setTimeout(rejoinNow, 5000); // brief drops often recover on their own
  });
  let rejoined = false;
  function rejoinNow() {
    if (rejoined) return;
    rejoined = true; pc.close();
    say('Connection lost. Rejoining…');
    setTimeout(() => joinAsReceiver(id).catch(error => say(error.message)), 1000);
  }
  pc.ontrack = event => { $('player').srcObject = event.streams[0]; $('player').play().catch(() => say('Tap ▶ to start audio.')); };
  let offer; while (!offer && !rejoined) { const { receivers } = await api(`/api/state?room=${encodeURIComponent(room)}`); offer = receivers[id]?.offer; if (!offer) await sleep(1000); }
  if (!offer) return;
  await pc.setRemoteDescription(offer); await pc.setLocalDescription(await pc.createAnswer()); await waitForIce(pc);
  await api('/api/answer', { method: 'POST', body: JSON.stringify({ room, id, description: pc.localDescription }) });
  say('Connected. Audio should start shortly.');
}

async function connectReceiver() {
  $('connectButton').disabled = true;
  try {
    room = roomFromUrl || $('roomInput').value.trim(); server = serverFromUrl || $('serverInput').value.trim().replace(/\/$/, '') || location.origin; if (!room) throw new Error('Missing room code.');
    await joinAsReceiver();
  } catch (error) { $('connectButton').disabled = false; say(error.message); }
}

if (role === 'receiver') { $('sourcePanel').hidden = true; $('receiverPanel').hidden = false; $('connectButton').addEventListener('click', connectReceiver); connectReceiver(); }
else { $('startButton').addEventListener('click', startSource); showReceiverLink().catch(error => say(error.message)); }
