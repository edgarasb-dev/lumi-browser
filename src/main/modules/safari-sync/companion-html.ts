export function renderCompanionHtml(deviceName: string): string {
  const escapedDeviceName = deviceName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <title>Lumi Companion · ${escapedDeviceName}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0b0e17;
      --surface: rgba(23, 28, 43, 0.85);
      --card: rgba(31, 38, 59, 0.72);
      --border: rgba(255, 255, 255, 0.11);
      --text: #f3f6fc;
      --muted: #98a4c0;
      --accent: #3b82f6;
      --accent-soft: rgba(59, 130, 246, 0.18);
      --success: #10b981;
      --danger: #ef4444;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f3f5fa;
        --surface: rgba(255, 255, 255, 0.88);
        --card: rgba(255, 255, 255, 0.96);
        --border: rgba(15, 23, 42, 0.09);
        --text: #0f172a;
        --muted: #64748b;
        --accent: #2563eb;
        --accent-soft: rgba(37, 99, 235, 0.1);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      background: radial-gradient(circle at top right, rgba(59,130,246,0.16), transparent 45%), var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: env(safe-area-inset-top, 16px) 16px calc(env(safe-area-inset-bottom, 16px) + 24px);
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 4px 18px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo {
      width: 36px;
      height: 36px;
      border-radius: 11px;
      background: linear-gradient(135deg, #0ea5e9, #2563eb);
      color: #fff;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 18px;
      box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
    }
    .title { font-size: 17px; font-weight: 700; margin: 0; }
    .subtitle { font-size: 12px; color: var(--muted); margin: 2px 0 0; }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--card);
      border: 1px solid var(--border);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--muted);
    }
    .dot.live { background: var(--success); box-shadow: 0 0 8px var(--success); }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 14px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: var(--surface);
      padding: 5px;
      border-radius: 14px;
      border: 1px solid var(--border);
      margin-bottom: 14px;
    }
    .tab-btn {
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
      padding: 9px 6px;
      border-radius: 10px;
      cursor: pointer;
    }
    .tab-btn.active {
      background: var(--accent);
      color: #fff;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      margin: 10px 0 6px;
    }
    input, select {
      width: 100%;
      padding: 12px 13px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-size: 15px;
      outline: none;
    }
    input:focus, select:focus { border-color: var(--accent); }
    .row {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    .btn {
      flex: 1;
      min-width: 130px;
      border: 0;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      background: var(--accent);
      color: #fff;
    }
    .btn.secondary {
      background: var(--accent-soft);
      color: var(--accent);
    }
    .btn:disabled { opacity: 0.55; cursor: default; }
    .list { display: flex; flex-direction: column; gap: 8px; }
    .item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px;
      border-radius: 13px;
      background: var(--surface);
      border: 1px solid var(--border);
      text-decoration: none;
      color: inherit;
    }
    .item-main { min-width: 0; flex: 1; }
    .item-title {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-url {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    .badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      white-space: nowrap;
    }
    .empty {
      text-align: center;
      padding: 28px 12px;
      color: var(--muted);
      font-size: 13px;
    }
    .status-msg {
      margin-top: 10px;
      font-size: 13px;
      font-weight: 500;
    }
    .status-msg.ok { color: var(--success); }
    .status-msg.err { color: var(--danger); }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="logo">L</div>
        <div>
          <h1 class="title">Lumi Companion</h1>
          <p class="subtitle">${escapedDeviceName}</p>
        </div>
      </div>
      <div class="pill">
        <span id="ws-dot" class="dot"></span>
        <span id="ws-label">Connecting</span>
      </div>
    </div>

    <div id="pair-view" class="card hidden">
      <h2 style="margin:0 0 6px;font-size:18px;">Pair with Lumi</h2>
      <p style="margin:0 0 12px;font-size:13px;color:var(--muted);">
        Enter the 6-digit pairing code shown in Lumi Settings → Safari &amp; Sync, or scan the QR code again.
      </p>
      <label for="pair-code">Pairing Code</label>
      <input id="pair-code" type="text" inputmode="numeric" maxlength="12" placeholder="e.g. 482910" autocomplete="off" />
      <div class="row">
        <button id="pair-btn" class="btn" type="button">Connect Device</button>
      </div>
      <div id="pair-msg" class="status-msg"></div>
    </div>

    <div id="app-view" class="hidden">
      <div class="tabs">
        <button class="tab-btn active" data-tab="send" type="button">Send</button>
        <button class="tab-btn" data-tab="tabs" type="button">Tabs</button>
        <button class="tab-btn" data-tab="favs" type="button">Favourites</button>
        <button class="tab-btn" data-tab="history" type="button">History</button>
      </div>

      <div id="panel-send" class="card">
        <h2 style="margin:0 0 4px;font-size:16px;">Send Link to Lumi</h2>
        <p style="margin:0 0 10px;font-size:12px;color:var(--muted);">
          Push any webpage from mobile Safari straight to your desktop.
        </p>
        <label for="send-url">Web URL</label>
        <input id="send-url" type="url" placeholder="https://example.com" autocomplete="off" />
        <label for="send-title">Title (optional)</label>
        <input id="send-title" type="text" placeholder="Page title" autocomplete="off" />
        <label for="send-space">Target Space</label>
        <select id="send-space"></select>
        <div class="row">
          <button id="send-open-btn" class="btn" type="button">Open in Lumi</button>
          <button id="send-inbox-btn" class="btn secondary" type="button">Add to Inbox</button>
          <button id="send-fav-btn" class="btn secondary" type="button">Save Favourite</button>
        </div>
        <div id="send-msg" class="status-msg"></div>
      </div>

      <div id="panel-tabs" class="card hidden">
        <input id="search-tabs" type="search" placeholder="Filter open tabs..." style="margin-bottom:12px;" />
        <div id="tabs-list" class="list"></div>
      </div>

      <div id="panel-favs" class="card hidden">
        <input id="search-favs" type="search" placeholder="Filter favourites..." style="margin-bottom:12px;" />
        <div id="favs-list" class="list"></div>
      </div>

      <div id="panel-history" class="card hidden">
        <input id="search-history" type="search" placeholder="Filter recent history..." style="margin-bottom:12px;" />
        <div id="history-list" class="list"></div>
      </div>
    </div>
  </div>

  <script>
    (function() {
      const TOKEN_KEY = "lumi_companion_token";
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");
      if (urlToken) {
        sessionStorage.setItem(TOKEN_KEY, urlToken);
        params.delete("token");
        const cleanUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
        window.history.replaceState({}, "", cleanUrl);
      }

      let token = sessionStorage.getItem(TOKEN_KEY) || "";
      let state = { spaces: [], openTabs: [], favourites: [], recentHistory: [] };
      let activeTab = "send";
      let ws = null;

      const pairView = document.getElementById("pair-view");
      const appView = document.getElementById("app-view");
      const wsDot = document.getElementById("ws-dot");
      const wsLabel = document.getElementById("ws-label");

      function setWsStatus(live, label) {
        wsDot.className = "dot" + (live ? " live" : "");
        wsLabel.textContent = label;
      }

      function showAuth(authenticated) {
        pairView.classList.toggle("hidden", authenticated);
        appView.classList.toggle("hidden", !authenticated);
      }

      function authHeaders() {
        return {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        };
      }

      function renderItems(containerId, items, query, badgeFn) {
        const container = document.getElementById(containerId);
        container.textContent = "";
        const q = (query || "").trim().toLowerCase();
        const filtered = q
          ? items.filter((item) => (item.title || "").toLowerCase().includes(q) || (item.url || "").toLowerCase().includes(q))
          : items;

        if (!filtered.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = q ? "No matching items." : "Nothing synced yet.";
          container.appendChild(empty);
          return;
        }

        for (const item of filtered.slice(0, 120)) {
          const a = document.createElement("a");
          a.className = "item";
          a.href = item.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";

          const main = document.createElement("div");
          main.className = "item-main";

          const title = document.createElement("div");
          title.className = "item-title";
          title.textContent = item.title || item.url;

          const urlEl = document.createElement("div");
          urlEl.className = "item-url";
          urlEl.textContent = item.url;

          main.appendChild(title);
          main.appendChild(urlEl);
          a.appendChild(main);

          if (badgeFn) {
            const label = badgeFn(item);
            if (label) {
              const badge = document.createElement("span");
              badge.className = "badge";
              badge.textContent = label;
              a.appendChild(badge);
            }
          }
          container.appendChild(a);
        }
      }

      function renderState() {
        const spaceSelect = document.getElementById("send-space");
        const prev = spaceSelect.value;
        spaceSelect.textContent = "";
        const autoOpt = document.createElement("option");
        autoOpt.value = "";
        autoOpt.textContent = "Current Active Space";
        spaceSelect.appendChild(autoOpt);
        for (const s of state.spaces || []) {
          const opt = document.createElement("option");
          opt.value = s.id;
          opt.textContent = s.name;
          spaceSelect.appendChild(opt);
        }
        if (prev) spaceSelect.value = prev;

        renderItems("tabs-list", state.openTabs || [], document.getElementById("search-tabs").value, (t) => t.spaceName);
        renderItems("favs-list", state.favourites || [], document.getElementById("search-favs").value);
        renderItems("history-list", state.recentHistory || [], document.getElementById("search-history").value);
      }

      async function fetchState() {
        if (!token) {
          showAuth(false);
          setWsStatus(false, "Pairing Required");
          return;
        }
        const res = await fetch("/api/state", { headers: authHeaders() });
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          token = "";
          showAuth(false);
          setWsStatus(false, "Pairing Required");
          return;
        }
        if (!res.ok) throw new Error("Failed to load state");
        state = await res.json();
        showAuth(true);
        renderState();
        connectWs();
      }

      function connectWs() {
        if (!token) return;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(proto + "//" + window.location.host + "/ws?token=" + encodeURIComponent(token));
        ws.onopen = () => setWsStatus(true, "Live");
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "state" && msg.payload) {
              state = msg.payload;
              renderState();
            }
          } catch {}
        };
        ws.onclose = () => {
          setWsStatus(false, "Reconnecting");
          setTimeout(() => { if (token) connectWs(); }, 2500);
        };
      }

      document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeTab = btn.getAttribute("data-tab");
          document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
          ["send", "tabs", "favs", "history"].forEach((name) => {
            document.getElementById("panel-" + name).classList.toggle("hidden", name !== activeTab);
          });
        });
      });

      document.getElementById("search-tabs").addEventListener("input", renderState);
      document.getElementById("search-favs").addEventListener("input", renderState);
      document.getElementById("search-history").addEventListener("input", renderState);

      document.getElementById("pair-btn").addEventListener("click", async () => {
        const code = document.getElementById("pair-code").value.trim();
        const msgEl = document.getElementById("pair-msg");
        msgEl.textContent = "";
        const res = await fetch("/api/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) {
          msgEl.className = "status-msg err";
          msgEl.textContent = data.error || "Invalid pairing code.";
          return;
        }
        token = data.token;
        sessionStorage.setItem(TOKEN_KEY, token);
        await fetchState();
      });

      async function sendLink(mode) {
        const url = document.getElementById("send-url").value.trim();
        const title = document.getElementById("send-title").value.trim();
        const spaceId = document.getElementById("send-space").value || undefined;
        const msgEl = document.getElementById("send-msg");
        msgEl.textContent = "";
        if (!url) {
          msgEl.className = "status-msg err";
          msgEl.textContent = "Enter a valid http:// or https:// URL.";
          return;
        }
        const res = await fetch("/api/send-link", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ url, title, spaceId, mode, deviceName: "Mobile Safari" })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          msgEl.className = "status-msg err";
          msgEl.textContent = data.error || "Could not send link.";
          return;
        }
        msgEl.className = "status-msg ok";
        msgEl.textContent = mode === "open" ? "Opened in Lumi!" : mode === "favourite" ? "Saved to Lumi Favourites!" : "Added to Lumi Sync Inbox!";
        document.getElementById("send-url").value = "";
        document.getElementById("send-title").value = "";
      }

      document.getElementById("send-open-btn").addEventListener("click", () => sendLink("open"));
      document.getElementById("send-inbox-btn").addEventListener("click", () => sendLink("inbox"));
      document.getElementById("send-fav-btn").addEventListener("click", () => sendLink("favourite"));

      fetchState().catch(() => setWsStatus(false, "Offline"));
    })();
  </script>
</body>
</html>`;
}
