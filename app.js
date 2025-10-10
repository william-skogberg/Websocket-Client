const AUTH_BASE   = "https://virtualboard-438y.onrender.com";     
const SERVER_URL  = "https://websocket-uxhx.onrender.com";       
const REFRESH_URL = AUTH_BASE + "/refresh";

// storage nycklar
const STORAGE_ACCESS  = "api_key";       
const STORAGE_REFRESH = "refresh_token";  

// element
const $ = (s) => document.querySelector(s);
const statusEl = $("#status");
const apiKeyIn = $("#apiKey");
const saveBtn = $("#save");
const reconnectBtn = $("#reconnect");
const logoutBtn = $("#logout");          
const textEl = $("#text");
const sendBtn = $("#send");
const clearBtn = $("#clear");
const copyBtn = $("#copy");
const pasteBtn = $("#paste");
const logEl = $("#log");
const loginUser = $("#loginUser");
const loginPass = $("#loginPass");
const loginBtn  = $("#loginBtn");
const loginMsg  = $("#loginMsg");

// hjälpfunktioner
function append(s) {
  const div = document.createElement("div");
  div.textContent = s;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(s) { statusEl.textContent = s; }
function getAccess()  { return localStorage.getItem(STORAGE_ACCESS)  || ""; }
function getRefresh() { return localStorage.getItem(STORAGE_REFRESH) || ""; }
function setAccess(t) { localStorage.setItem(STORAGE_ACCESS, t); apiKeyIn.value = t; }
function setRefresh(t){ localStorage.setItem(STORAGE_REFRESH, t || ""); }

//initsialisera
(function load() {
  apiKeyIn.value = getAccess();
})();

saveBtn.onclick = () => { setAccess(apiKeyIn.value.trim()); append("api_key sparad"); };

//login mot auth
loginBtn.onclick = async () => {
  loginMsg.textContent = "Loggar in…";
  try {
    const r = await fetch(AUTH_BASE + "/login", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ username: loginUser.value.trim(), password: loginPass.value })
    });
    if (!r.ok) throw new Error("Login failed");
    const data = await r.json();
    const access  = data.accessToken || data.token;
    const refresh = data.refreshToken;
    if (!access || !refresh) throw new Error("Inga tokens i svaret");
    setAccess(access);
    setRefresh(refresh);
    loginMsg.textContent = "Tokens sparade — klicka Reconnect";
    append("✅ login ok — tokens sparade");
  } catch (e) {
    loginMsg.textContent = "Login misslyckades";
    append("❌ login misslyckades: " + e.message);
  }
};

// refresh access token
async function ensureRefreshToken() {
  let rt = getRefresh();
  if (!rt) {
    rt = window.prompt("Klistra in din REFRESH TOKEN (från /login):", "");
    if (rt && rt.trim()) {
      setRefresh(rt.trim());
      append("refresh token sparad");
    } else {
      append("ingen refresh token angiven");
      return null;
    }
  }
  return rt;
}

async function refreshAccessToken() {
  const rt = await ensureRefreshToken();
  if (!rt) throw new Error("no-refresh");

  const r = await fetch(REFRESH_URL, {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      Authorization: `Bearer ${rt}`
    },
    body: JSON.stringify({ refreshToken: rt }) 
  });
  if (!r.ok) throw new Error("refresh-failed");
  const data = await r.json();
  const newAccess = data.accessToken || data.token;
  setAccess(newAccess);
  append("🔄 access token uppdaterad via /refresh");
  return newAccess;
}

// logout
async function logout() {
  const rt = getRefresh();
  try {
    if (rt) {
      await fetch(REFRESH_URL, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${rt}` }
      });
    }
  } catch (_) {
  
  }
  localStorage.removeItem(STORAGE_ACCESS);
  localStorage.removeItem(STORAGE_REFRESH);
  apiKeyIn.value = "";
  if (socket) { try { socket.disconnect(); } catch {} }
  setStatus("disconnected");
  append("🚪 utloggad");
}
logoutBtn && (logoutBtn.onclick = logout);

// socket io
let socket;
function connect() {
  if (socket) { try { socket.disconnect(); } catch{} socket = null; }

  const token = (apiKeyIn.value || "").trim();
  if (!token) { append("❗ saknar api_key (access token)"); setStatus("disconnected"); return; }

  setStatus("connecting");
  socket = io(SERVER_URL, {
    transports: ["websocket"],
    auth: { token }
  });

  socket.on("connect", () => {
    setStatus("connected");
    append("✅ connected");
  });

  socket.on("connect_error", async (err) => {
    const msg = err?.message || "unknown";
    if (msg === "TOKEN_EXPIRED") {
      append("⏳ token har gått ut – försöker /refresh…");
      try {
        await refreshAccessToken();
        setTimeout(connect, 100);
        return;
      } catch {
        append("❗ refresh misslyckades — logga in eller klistra in refresh token.");
      }
    } else if (msg === "BAD_TOKEN") {
      append("❌ ogiltig api_key — kontrollera hemlighet/algoritm eller hämta ny via Login.");
    } else if (msg === "NO_TOKEN") {
      append("❗ ingen api_key — logga in eller klistra in access token.");
    } else {
      append("connect_error: " + msg);
    }
    setStatus("disconnected");
  });

  socket.on("disconnect", (reason) => {
    append("🔌 disconnected: " + reason);
    setStatus("disconnected");
  });

  socket.on("status", (s) => append("ℹ️ status: " + JSON.stringify(s)));
  socket.on("paste",  (msg) => {
    const line = `[${new Date(msg.ts).toLocaleTimeString()}] ${msg.from ?? "okänd"}: ${msg.text}`;
    append("📥 " + line);
    textEl.value = msg.text;
  });
}

reconnectBtn.onclick = connect;

// Skicka,rensa clipboard
sendBtn.onclick = () => {
  if (!socket || !socket.connected) return append("❗ ej ansluten");
  socket.emit("paste", { text: textEl.value });
  append("skickat!");
};
clearBtn.onclick = () => textEl.value = "";
copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(textEl.value);
    append("kopierat till urklipp");
  } catch {
    append("kopiera kräver säker kontext (https eller localhost).");
  }
};
pasteBtn.onclick = async () => {
  try {
    const t = await navigator.clipboard.readText();
    textEl.value = t;
    append("klistrade in från urklipp");
  } catch {
    append("läsa urklipp kräver säker kontext (https eller localhost).");
  }
};

// Auto-connect med sparad token vid laddning
connect();
