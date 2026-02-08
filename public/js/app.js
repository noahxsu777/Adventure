/* ============================================================
   TikTok Live Chat TTS – Frontend App
   ============================================================ */
(() => {
  'use strict';

  /* ---------- DOM refs ---------- */
  const $ = (s) => document.querySelector(s);
  const usernameInput   = $('#usernameInput');
  const connectBtn      = $('#connectBtn');
  const disconnectBtn   = $('#disconnectBtn');
  const statusBadge     = $('#statusBadge');
  const chatMessages    = $('#chatMessages');

  const toggleChat      = $('#toggleChat');
  const toggleGift      = $('#toggleGift');
  const toggleLike      = $('#toggleLike');
  const toggleFollow    = $('#toggleFollow');

  const ttsPlayBtn      = $('#ttsPlayBtn');
  const ttsPauseBtn     = $('#ttsPauseBtn');
  const ttsStopBtn      = $('#ttsStopBtn');
  const volumeSlider    = $('#volumeSlider');
  const speedSlider     = $('#speedSlider');
  const speedValue      = $('#speedValue');
  const voiceSelect     = $('#voiceSelect');
  const readUsernameToggle = $('#readUsernameToggle');

  const filterEnabled   = $('#filterEnabled');
  const filterKeywords  = $('#filterKeywords');

  const queueCount      = $('#queueCount');
  const queueList       = $('#queueList');

  /* ---------- State ---------- */
  let ws = null;
  let ttsQueue = [];
  let isSpeaking = false;
  let isPaused = false;
  const MAX_CHAT_ITEMS = 300;
  const seenIds = new Set();

  /* ---------- WebSocket ---------- */
  function connectWs(username) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'connect', username }));
      setStatus('connecting');
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      handleEvent(msg);
    });

    ws.addEventListener('close', () => {
      setStatus('offline');
    });

    ws.addEventListener('error', () => {
      setStatus('offline');
    });
  }

  function disconnectWs() {
    if (ws) {
      ws.send(JSON.stringify({ type: 'disconnect' }));
      ws.close();
      ws = null;
    }
    setStatus('offline');
  }

  function setStatus(s) {
    statusBadge.textContent = s === 'online' ? 'Live' : s === 'connecting' ? 'Connecting…' : 'Offline';
    statusBadge.className = s === 'online' ? 'badge badge-on' : 'badge badge-off';
    connectBtn.classList.toggle('hidden', s === 'online' || s === 'connecting');
    disconnectBtn.classList.toggle('hidden', s !== 'online' && s !== 'connecting');
  }

  /* ---------- Event handler ---------- */
  function handleEvent(msg) {
    switch (msg.type) {
      case 'connected':
        setStatus('online');
        break;
      case 'disconnected':
        setStatus('offline');
        break;
      case 'error':
        setStatus('offline');
        appendSystem(`Error: ${msg.message}`);
        break;
      case 'chat':
        if (toggleChat.checked) {
          appendMessage('chat', msg.user, msg.comment, msg.profilePictureUrl);
          enqueueTTS(msg.user, msg.comment, 'chat');
        }
        break;
      case 'gift':
        if (toggleGift.checked) {
          const text = `sent ${msg.giftName} ×${msg.repeatCount}`;
          appendMessage('gift', msg.user, text, msg.profilePictureUrl);
          enqueueTTS(msg.user, text, 'gift');
        }
        break;
      case 'like':
        if (toggleLike.checked) {
          const text = `sent ${msg.likeCount} like${msg.likeCount > 1 ? 's' : ''}`;
          appendMessage('like', msg.user, text, msg.profilePictureUrl);
        }
        break;
      case 'follow':
        if (toggleFollow.checked) {
          appendMessage('follow', msg.user, 'followed!', msg.profilePictureUrl);
          enqueueTTS(msg.user, 'just followed!', 'follow');
        }
        break;
      default:
        break;
    }
  }

  /* ---------- Chat panel ---------- */
  function appendMessage(type, user, text, avatarUrl) {
    const div = document.createElement('div');
    div.className = `msg ${type}`;

    const img = document.createElement('img');
    img.className = 'msg-avatar';
    img.src = avatarUrl || '';
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = function () { this.style.display = 'none'; };

    const body = document.createElement('div');
    body.className = 'msg-body';
    body.innerHTML = `<span class="msg-user">@${escapeHtml(user)}</span> <span class="msg-text">${escapeHtml(text)}</span>`;

    div.appendChild(img);
    div.appendChild(body);
    chatMessages.appendChild(div);

    /* auto-scroll */
    chatMessages.scrollTop = chatMessages.scrollHeight;

    /* limit DOM nodes */
    while (chatMessages.children.length > MAX_CHAT_ITEMS) {
      chatMessages.removeChild(chatMessages.firstChild);
    }
  }

  function appendSystem(text) {
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `<div class="msg-body"><span class="msg-text" style="color:var(--accent)">${escapeHtml(text)}</span></div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ---------- TTS System ---------- */
  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';
    voices.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelect.appendChild(opt);
    });
  }

  speechSynthesis.addEventListener('voiceschanged', populateVoices);
  populateVoices();

  function enqueueTTS(user, text, eventType) {
    /* deduplicate by content hash */
    const id = `${user}:${text}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);
    /* After a while, reset to prevent unbounded growth */
    if (seenIds.size > 2000) {
      seenIds.clear();
    }

    /* keyword filter */
    if (filterEnabled.checked) {
      const kw = filterKeywords.value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      if (kw.length && !kw.some(k => text.toLowerCase().includes(k))) return;
    }

    const label = readUsernameToggle.checked ? `${user} says: ${text}` : text;
    ttsQueue.push(label);
    renderQueue();
    processQueue();
  }

  function processQueue() {
    if (isSpeaking || isPaused || ttsQueue.length === 0) return;
    isSpeaking = true;

    const next = ttsQueue.shift();
    renderQueue();

    const utter = new SpeechSynthesisUtterance(next);
    utter.volume = parseFloat(volumeSlider.value);
    utter.rate   = parseFloat(speedSlider.value);

    const voices = speechSynthesis.getVoices();
    const idx = parseInt(voiceSelect.value, 10);
    if (voices[idx]) utter.voice = voices[idx];

    utter.onend = () => { isSpeaking = false; processQueue(); };
    utter.onerror = () => { isSpeaking = false; processQueue(); };

    speechSynthesis.speak(utter);
  }

  function renderQueue() {
    queueCount.textContent = ttsQueue.length;
    queueList.innerHTML = '';
    ttsQueue.slice(0, 20).forEach((item, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1}. ${item}`;
      queueList.appendChild(li);
    });
  }

  /* ---------- TTS controls ---------- */
  ttsPlayBtn.addEventListener('click', () => {
    isPaused = false;
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
    } else {
      processQueue();
    }
  });

  ttsPauseBtn.addEventListener('click', () => {
    isPaused = true;
    speechSynthesis.pause();
  });

  ttsStopBtn.addEventListener('click', () => {
    isPaused = false;
    isSpeaking = false;
    ttsQueue.length = 0;
    speechSynthesis.cancel();
    renderQueue();
  });

  speedSlider.addEventListener('input', () => {
    speedValue.textContent = `${parseFloat(speedSlider.value).toFixed(1)}×`;
  });

  filterEnabled.addEventListener('change', () => {
    filterKeywords.disabled = !filterEnabled.checked;
  });

  /* ---------- Connection buttons ---------- */
  connectBtn.addEventListener('click', () => {
    const u = usernameInput.value.trim();
    if (u) connectWs(u);
  });

  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connectBtn.click();
  });

  disconnectBtn.addEventListener('click', disconnectWs);

  /* ---------- Keep TTS alive when tab hidden ---------- */
  /* The Web Speech API continues in background on most browsers.
     We add a periodic nudge to prevent Chrome from throttling it. */
  setInterval(() => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }, 10000);
})();
