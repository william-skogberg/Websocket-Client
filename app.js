const SERVER_URL = 'https://websocket-uxhx.onrender.com'

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

const STORAGE_KEY = 'api_key'; 

// spara api i localstorage
function loadApiKey(){
  const v = localStorage.getItem(STORAGE_KEY) || '';
  apiKeyIn.value = v;
}
function saveApiKey(){
  const v = apiKeyIn.value.trim();
  localStorage.setItem(STORAGE_KEY, v);
  append('api_key sparad');
}

saveBtn.onclick = saveApiKey;

// Socket.IO-anslutning
let socket;
function setStatus(s){ statusEl.textContent = s; }
function append(s){
  const div = document.createElement('div'); div.textContent = s;
  logEl.appendChild(div); logEl.scrollTop = logEl.scrollHeight;
}

function connect(){
  if (socket) { try{ socket.disconnect(); }catch{} socket = null; }
  const token = apiKeyIn.value.trim();
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

  socket.on('connect_error', (err) => {
    if (err?.message === 'TOKEN_EXPIRED'){
      append(' token har gått ut – klistra in ny api_key (logga in igen i Projekt 1) och tryck Reconnect.');
    } else if (err?.message === 'BAD_TOKEN') {
      append(' ogiltig api_key – kontrollera att den är signerad med rätt hemlighet/algoritm.');
    } else if (err?.message === 'NO_TOKEN') {
      append(' ingen api_key – klistra in access token.');
    } else {
      append(' connect_error: ' + err.message);
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
    // copypaste åt båda hållen
    textEl.value = msg.text;
  });
}

reconnectBtn.onclick = connect;

//skickar knappar
sendBtn.onclick = () => {
  if (!socket || !socket.connected) return append('❗ ej ansluten');
  socket.emit('paste', { text: textEl.value });
  append(' skickat!');
};
clearBtn.onclick = () => textEl.value = '';

copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(textEl.value);
    append(' kopierat till urklipp');
  } catch {
    append(' kopiera kräver säker kontext (https eller localhost).');
  }
};
pasteBtn.onclick = async () => {
  try {
    const t = await navigator.clipboard.readText();
    textEl.value = t;
    append(' klistrade in från urklipp');
  } catch {
    append(' läsa urklipp kräver säker kontext (https eller localhost).');
  }
};

loadApiKey();
connect();
