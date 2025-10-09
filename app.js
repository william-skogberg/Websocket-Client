const SERVER_URL  = 'https://websocket-uxhx.onrender.com';        // ws server
const REFRESH_URL = 'https://virtualboard-438y.onrender.com/api/auth/refresh';         // virtualboard api

const STORAGE_ACCESS = 'api_key';          // access token 
const STORAGE_REFRESH = 'refresh_token';   // refresh token 

const $ = s => document.querySelector(s);
const statusEl = $('#status');
const apiKeyIn = $('#apiKey');
const saveBtn = $('#save');
const reconnectBtn = $('#reconnect');
const textEl = $('#text');
const sendBtn = $('#send');
const clearBtn = $('#clear');
const copyBtn = $('#copy');
const pasteBtn = $('#paste');
const logEl = $('#log');

function append(s){
  const div = document.createElement('div'); div.textContent = s;
  logEl.appendChild(div); logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(s){ statusEl.textContent = s; }

function getAccess(){ return localStorage.getItem(STORAGE_ACCESS) || ''; }
function setAccess(t){ localStorage.setItem(STORAGE_ACCESS, t); apiKeyIn.value = t; }
function getRefresh(){ return localStorage.getItem(STORAGE_REFRESH) || ''; }
function setRefresh(t){ localStorage.setItem(STORAGE_REFRESH, t || ''); }

function loadApiKey(){
  apiKeyIn.value = getAccess();
}
function saveApiKey(){
  const v = apiKeyIn.value.trim();
  setAccess(v);
  append('api_key sparad');
}
saveBtn.onclick = saveApiKey;

// refresh-hjälpare 
async function ensureRefreshToken() {
  let rt = getRefresh();
  if (!rt) {
    rt = window.prompt('Klistra in din REFRESH TOKEN från login:', '');
    if (rt && rt.trim()) {
      setRefresh(rt.trim());
      append('refresh token sparad');
    } else {
      append('ingen refresh token angiven – auto-refresh inaktiverad');
      return null;
    }
  }
  return rt;
}

async function refreshAccessToken() {
  const rt = await ensureRefreshToken();
  if (!rt) throw new Error('no-refresh');

  const r = await fetch(REFRESH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${rt}` }
  });
  if (!r.ok) throw new Error('refresh-failed');
  const data = await r.json();
  const newAccess = data.accessToken || data.token;
  if (!newAccess) throw new Error('no-access-returned');
  setAccess(newAccess);
  append('🔄 access token uppdaterad via /refresh');
  return newAccess;
}

// socket io
let socket;
function connect(){
  if (socket) { try{ socket.disconnect(); }catch{} socket = null; }

  const token = (apiKeyIn.value || '').trim();
  if (!token){ append('❗ saknar api_key (access token)'); setStatus('disconnected'); return; }

  setStatus('connecting');
  socket = io(SERVER_URL, {
    transports:['websocket'],
    auth: { token }
  });

  socket.on('connect', () => {
    setStatus('connected');
    append('✅ connected');
  });

  socket.on('connect_error', async (err) => {
    const msg = err?.message || 'unknown';
    if (msg === 'TOKEN_EXPIRED') {
      append('⏳ token har gått ut – försöker /refresh…');
      try {
        await refreshAccessToken();
        // försök direkt igen med nya access token
        setTimeout(connect, 100);
        return;
      } catch (e) {
        append('❗ refresh misslyckades – klistra in ny api_key eller lägg in refresh token.');
      }
    } else if (msg === 'BAD_TOKEN') {
      append('❌ ogiltig api_key – kontrollera att den är signerad med rätt hemlighet/algoritm.');
    } else if (msg === 'NO_TOKEN') {
      append('❗ ingen api_key – klistra in access token.');
    } else {
      append('connect_error: ' + msg);
    }
    setStatus('disconnected');
  });

  socket.on('disconnect', (reason) => {
    append('🔌 disconnected: ' + reason);
    setStatus('disconnected');
  });

  socket.on('status', (s) => append('ℹ️ status: '+JSON.stringify(s)));
  socket.on('paste', (msg) => {
    const line = `[${new Date(msg.ts).toLocaleTimeString()}] ${msg.from ?? 'okänd'}: ${msg.text}`;
    append('📥 ' + line);
    textEl.value = msg.text; 
  });
}

reconnectBtn.onclick = connect;

// skickaknappar
sendBtn.onclick = () => {
  if (!socket || !socket.connected) return append('❗ ej ansluten');
  socket.emit('paste', { text: textEl.value });
  append('skickat!');
};
clearBtn.onclick = () => textEl.value = '';

copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(textEl.value);
    append('kopierat till urklipp');
  } catch {
    append('kopiera kräver säker kontext (https eller localhost).');
  }
};
pasteBtn.onclick = async () => {
  try {
    const t = await navigator.clipboard.readText();
    textEl.value = t;
    append('klistrade in från urklipp');
  } catch {
    append('läsa urklipp kräver säker kontext (https eller localhost).');
  }
};

loadApiKey();
connect();
