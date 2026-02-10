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

  const ttsToggleBtn    = $('#ttsToggleBtn');
  const volumeSlider    = $('#volumeSlider');
  const speedSlider     = $('#speedSlider');
  const speedValue      = $('#speedValue');
  const voiceSelect     = $('#voiceSelect');
  const readUsernameToggle = $('#readUsernameToggle');

  const ttsProvider     = $('#ttsProvider');
  const browserVoiceGroup = $('#browserVoiceGroup');
  const seVoiceGroup    = $('#seVoiceGroup');
  const seVoiceSelect   = $('#seVoiceSelect');
  const gttsLangGroup   = $('#gttsLangGroup');
  const gttsLangSelect  = $('#gttsLangSelect');
  const tiktokVoiceGroup = $('#tiktokVoiceGroup');
  const tiktokVoiceSelect = $('#tiktokVoiceSelect');
  const testTtsBtn      = $('#testTtsBtn');

  const filterEnabled   = $('#filterEnabled');
  const filterKeywords  = $('#filterKeywords');

  const queueCount      = $('#queueCount');
  const queueList       = $('#queueList');

  const giftGalleryGrid = $('#giftGalleryGrid');
  const giftSearch      = $('#giftSearch');
  const soundLibrary    = $('#soundLibrary');

  /* ---------- State ---------- */
  let ws = null;
  let ttsQueue = [];
  let isSpeaking = false;
  let ttsEnabled = true;
  let userDisconnected = false;
  let currentUsername = '';
  let currentAudio = null;
  let reconnectAttempts = 0;
  const MAX_CHAT_ITEMS = 300;
  const seenIds = new Set();
  const BASE_RECONNECT_DELAY = 3000;
  const MAX_RECONNECT_DELAY = 30000;
  let wakeLock = null;

  /* ---------- Service Worker Registration ---------- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('SW registered, scope:', reg.scope))
      .catch((err) => console.warn('SW registration failed:', err));
  }

  /* ---------- Request notification permission ---------- */
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  /* ---------- Wake Lock: keep screen/device awake ---------- */
  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch { /* device doesn't support or permission denied */ }
  }

  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
  }

  /* Re-acquire wake lock on visibility change */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ttsEnabled) {
      requestWakeLock();
    }
  });

  /* Gift gallery: { key: { name, imageUrl, diamonds, count } } */
  const giftRegistry = {};

  /* Gift sound assignments: { key: soundId } */
  const giftSounds = {};

  /* Pre-populate gallery from static catalog (loaded from gifts.js) */
  /* Name → key lookup for O(1) matching during live events */
  const giftNameIndex = {};
  if (typeof TIKTOK_GIFT_CATALOG !== 'undefined') {
    TIKTOK_GIFT_CATALOG.forEach((g, i) => {
      const key = 'catalog_' + i;
      giftRegistry[key] = { name: g.name, imageUrl: g.image, diamonds: 0, count: 0 };
      giftNameIndex[g.name.toLowerCase()] = key;
    });
  }

  /* ---------- Built-in alert sounds ---------- */
  const ALERT_SOUNDS = [
    { id: 'chime',     name: '🔔 Chime',      freq: 880,  type: 'sine',     dur: 0.4 },
    { id: 'ding',      name: '✨ Ding',       freq: 1200, type: 'sine',     dur: 0.25 },
    { id: 'coin',      name: '🪙 Coin',       freq: 1400, type: 'square',   dur: 0.2 },
    { id: 'pop',       name: '💥 Pop',        freq: 600,  type: 'triangle', dur: 0.15 },
    { id: 'fanfare',   name: '🎺 Fanfare',    freq: 700,  type: 'sawtooth', dur: 0.5 },
    { id: 'twinkle',   name: '⭐ Twinkle',    freq: 1000, type: 'sine',     dur: 0.35 },
    { id: 'alert',     name: '🚨 Alert',      freq: 500,  type: 'square',   dur: 0.6 },
    { id: 'bell',      name: '🔕 Bell',       freq: 1500, type: 'sine',     dur: 0.3 },
  ];

  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playAlertSound(soundId) {
    const s = ALERT_SOUNDS.find(a => a.id === soundId);
    if (!s) return;
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = s.type;
    osc.frequency.value = s.freq;
    gain.gain.setValueAtTime(parseFloat(volumeSlider.value) * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + s.dur);
  }

  /* ---------- Tab navigation ---------- */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  /* ---------- Sound Library UI ---------- */
  function renderSoundLibrary() {
    soundLibrary.innerHTML = '';
    ALERT_SOUNDS.forEach(s => {
      const div = document.createElement('div');
      div.className = 'sound-item';
      const span = document.createElement('span');
      span.textContent = s.name;
      div.appendChild(span);
      const btn = document.createElement('button');
      btn.textContent = '▶ Play';
      btn.addEventListener('click', () => playAlertSound(s.id));
      div.appendChild(btn);
      soundLibrary.appendChild(div);
    });
  }
  renderSoundLibrary();
  renderGiftGallery();

  /* Gift search filter */
  giftSearch.addEventListener('input', () => {
    renderGiftGallery(giftSearch.value);
  });

  /* ---------- TTS Provider switching ---------- */
  ttsProvider.addEventListener('change', () => {
    const val = ttsProvider.value;
    browserVoiceGroup.classList.toggle('hidden', val !== 'browser');
    seVoiceGroup.classList.toggle('hidden', val !== 'streamelements');
    gttsLangGroup.classList.toggle('hidden', val !== 'google');
    tiktokVoiceGroup.classList.toggle('hidden', val !== 'tiktok');
  });

  /* ---------- TTS Toggle ---------- */
  ttsToggleBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    ttsToggleBtn.classList.toggle('active', ttsEnabled);
    ttsToggleBtn.textContent = ttsEnabled ? '🔊 Chat TTS Active' : '🔇 Enable Chat TTS';
    if (ttsEnabled) {
      requestWakeLock();
      mediaSessionIdle();
    } else {
      speechSynthesis.cancel();
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      ttsQueue.length = 0;
      isSpeaking = false;
      renderQueue();
      releaseWakeLock();
      updateMediaSession(null);
    }
  });

  /* ---------- WebSocket with exponential backoff reconnect ---------- */
  function connectWs(username) {
    currentUsername = username;
    userDisconnected = false;
    setStatus('connecting');

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.addEventListener('open', () => {
      reconnectAttempts = 0;
      ws.send(JSON.stringify({ type: 'connect', username }));
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      handleEvent(msg);
    });

    ws.addEventListener('close', () => {
      if (!userDisconnected && currentUsername) {
        setStatus('reconnecting');
        reconnectAttempts++;
        const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
        setTimeout(() => {
          if (!userDisconnected && currentUsername) {
            connectWs(currentUsername);
          }
        }, delay);
      } else {
        setStatus('offline');
      }
    });

    ws.addEventListener('error', () => {
      /* close event will fire after error, triggering reconnect */
    });
  }

  function disconnectWs() {
    userDisconnected = true;
    currentUsername = '';
    reconnectAttempts = 0;
    if (ws) {
      try { ws.send(JSON.stringify({ type: 'disconnect' })); } catch {}
      ws.close();
      ws = null;
    }
    setStatus('offline');
  }

  function setStatus(s) {
    if (s === 'online') {
      statusBadge.textContent = '● Live';
      statusBadge.className = 'badge badge-on';
    } else if (s === 'connecting') {
      statusBadge.textContent = 'Connecting…';
      statusBadge.className = 'badge badge-connecting';
    } else if (s === 'reconnecting') {
      statusBadge.textContent = 'Reconnecting…';
      statusBadge.className = 'badge badge-connecting';
    } else {
      statusBadge.textContent = 'Offline';
      statusBadge.className = 'badge badge-off';
    }
    connectBtn.classList.toggle('hidden', s !== 'offline');
    disconnectBtn.classList.toggle('hidden', s === 'offline');
  }

  /* ---------- Event handler ---------- */
  function handleEvent(msg) {
    switch (msg.type) {
      case 'status':
        /* Server status steps — just log, no overlay */
        break;
      case 'connected':
        setStatus('online');
        break;
      case 'disconnected':
        /* User-initiated disconnect — go offline */
        setStatus('offline');
        break;
      case 'tiktok_reconnecting':
        /* Server is auto-reconnecting TikTok — just show status, don't touch WS */
        setStatus('reconnecting');
        appendSystem(msg.message || 'Reconnecting to stream…');
        break;
      case 'error':
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
          appendGiftMessage(msg.user, msg.giftName, msg.repeatCount, msg.diamondCount, msg.giftPictureUrl, msg.profilePictureUrl);
          enqueueTTS(msg.user, text, 'gift');
          registerGift(msg.giftId, msg.giftName, msg.giftPictureUrl, msg.diamondCount, msg.repeatCount);
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

    chatMessages.scrollTop = chatMessages.scrollHeight;

    while (chatMessages.children.length > MAX_CHAT_ITEMS) {
      chatMessages.removeChild(chatMessages.firstChild);
    }
  }

  function appendGiftMessage(user, giftName, repeatCount, diamondCount, giftPictureUrl, avatarUrl) {
    const div = document.createElement('div');
    div.className = 'msg gift';

    const img = document.createElement('img');
    img.className = 'msg-avatar';
    img.src = avatarUrl || '';
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = function () { this.style.display = 'none'; };

    const body = document.createElement('div');
    body.className = 'msg-body';

    const giftImgTag = giftPictureUrl
      ? (() => {
          const gImg = document.createElement('img');
          gImg.className = 'msg-gift-img';
          gImg.src = giftPictureUrl;
          gImg.alt = giftName;
          gImg.onerror = function () { this.style.display = 'none'; };
          return gImg;
        })()
      : null;

    const diamondText = diamondCount ? ` (💎${diamondCount})` : '';
    const userSpan = document.createElement('span');
    userSpan.className = 'msg-user';
    userSpan.textContent = `@${user}`;

    const textSpan = document.createElement('span');
    textSpan.className = 'msg-text';
    textSpan.textContent = ` sent `;

    body.appendChild(userSpan);
    body.appendChild(textSpan);
    if (giftImgTag) body.appendChild(giftImgTag);
    const nameNode = document.createTextNode(`${giftName} ×${repeatCount}${diamondText}`);
    body.appendChild(nameNode);

    div.appendChild(img);
    div.appendChild(body);
    chatMessages.appendChild(div);

    chatMessages.scrollTop = chatMessages.scrollHeight;

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

  /* ---------- Gift Gallery ---------- */
  function registerGift(giftId, name, imageUrl, diamonds, count) {
    if (!giftId && !name) return;

    /* O(1) lookup by name into the catalog */
    let key = giftId ? String(giftId) : null;
    const catalogKey = name ? giftNameIndex[name.toLowerCase()] : undefined;

    if (catalogKey) {
      /* Update the catalog entry with live data */
      giftRegistry[catalogKey].count += (count || 1);
      if (imageUrl) giftRegistry[catalogKey].imageUrl = imageUrl;
      if (diamonds) giftRegistry[catalogKey].diamonds = diamonds;
      key = catalogKey;
    } else if (key && giftRegistry[key]) {
      giftRegistry[key].count += (count || 1);
    } else if (key) {
      giftRegistry[key] = { name, imageUrl, diamonds, count: count || 1 };
    }

    const assignedSound = giftSounds[key];
    if (assignedSound) {
      playAlertSound(assignedSound);
    }

    renderGiftGallery(giftSearch.value);
  }

  function renderGiftGallery(filter) {
    const term = (filter || '').toLowerCase();
    const ids = Object.keys(giftRegistry).filter(gid => {
      if (!term) return true;
      return giftRegistry[gid].name.toLowerCase().includes(term);
    });
    if (ids.length === 0) {
      giftGalleryGrid.innerHTML = term
        ? '<div class="gift-empty">No gifts match your search.</div>'
        : '<div class="gift-empty">No gifts available.</div>';
      return;
    }

    giftGalleryGrid.innerHTML = '';
    ids.forEach(gid => {
      const g = giftRegistry[gid];
      const card = document.createElement('div');
      card.className = 'gift-card';

      if (g.imageUrl) {
        const gImg = document.createElement('img');
        gImg.src = g.imageUrl;
        gImg.alt = g.name;
        gImg.onerror = function () { this.src = ''; };
        card.appendChild(gImg);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'width:56px;height:56px;background:var(--surface2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;';
        placeholder.textContent = '🎁';
        card.appendChild(placeholder);
      }

      const nameDiv = document.createElement('div');
      nameDiv.className = 'gift-card-name';
      nameDiv.textContent = g.name;
      card.appendChild(nameDiv);

      if (g.diamonds) {
        const diamDiv = document.createElement('div');
        diamDiv.className = 'gift-card-diamonds';
        diamDiv.textContent = `💎 ${g.diamonds}`;
        card.appendChild(diamDiv);
      }

      if (g.count > 0) {
        const countDiv = document.createElement('div');
        countDiv.className = 'gift-card-count';
        countDiv.textContent = `Received: ${g.count}×`;
        card.appendChild(countDiv);
      }

      const sel = document.createElement('select');
      sel.dataset.gid = gid;
      const noOpt = document.createElement('option');
      noOpt.value = '';
      noOpt.textContent = 'No sound';
      sel.appendChild(noOpt);
      ALERT_SOUNDS.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        if (giftSounds[gid] === s.id) opt.selected = true;
        sel.appendChild(opt);
      });
      card.appendChild(sel);

      const testBtn = document.createElement('button');
      testBtn.className = 'btn-play-sound';
      testBtn.textContent = '▶ Test';
      card.appendChild(testBtn);

      sel.addEventListener('change', () => {
        if (sel.value) {
          giftSounds[gid] = sel.value;
        } else {
          delete giftSounds[gid];
        }
      });

      testBtn.addEventListener('click', () => {
        const sid = giftSounds[gid] || sel.value;
        if (sid) playAlertSound(sid);
      });

      giftGalleryGrid.appendChild(card);
    });
  }

  /* Load all available TikTok gifts from the API into the gallery */
  /* ---------- Media Session API ---------- */

  /* Register action handlers once at startup */
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('pause', () => {
      if (currentAudio) currentAudio.pause();
      navigator.mediaSession.playbackState = 'paused';
    });
    navigator.mediaSession.setActionHandler('play', () => {
      if (currentAudio) currentAudio.play();
      navigator.mediaSession.playbackState = 'playing';
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      speechSynthesis.cancel();
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      ttsQueue.length = 0;
      isSpeaking = false;
      renderQueue();
      updateMediaSession(null);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      speechSynthesis.cancel();
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      isSpeaking = false;
      processQueue();
    });
  }

  function updateMediaSession(text) {
    if (!('mediaSession' in navigator)) return;
    if (!text) {
      /* TTS disabled — clear session completely */
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: text.length > 60 ? text.slice(0, 57) + '…' : text,
      artist: 'TikTok Live TTS',
      album: currentUsername ? `@${currentUsername}` : 'Live Stream'
    });
    navigator.mediaSession.playbackState = 'playing';
  }

  /* Show idle state in media session when queue drains */
  function mediaSessionIdle() {
    if (!('mediaSession' in navigator) || !ttsEnabled) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Waiting for messages…',
      artist: 'TikTok Live TTS',
      album: currentUsername ? `@${currentUsername}` : 'Live Stream'
    });
    navigator.mediaSession.playbackState = 'playing';
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

  function speakViaAudio(url, text) {
    const audio = new Audio(url);
    currentAudio = audio;
    audio.volume = parseFloat(volumeSlider.value);
    audio.playbackRate = parseFloat(speedSlider.value);
    updateMediaSession(text || 'Reading message…');

    /* Timeout protection: skip if audio doesn't finish in 30s */
    const timeout = setTimeout(() => {
      if (currentAudio === audio) {
        audio.pause();
        audio.removeAttribute('src');
        currentAudio = null;
        isSpeaking = false;
        processQueue();
      }
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
      if (currentAudio === audio) currentAudio = null;
      isSpeaking = false;
      processQueue();
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;
    audio.play().catch(cleanup);
  }

  function speakStreamElements(text) {
    const voice = seVoiceSelect.value;
    const url = `/api/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
    speakViaAudio(url, text);
  }

  function speakGoogleTranslate(text) {
    const lang = gttsLangSelect.value;
    const url = `/api/gtts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`;
    speakViaAudio(url, text);
  }

  function speakTikTok(text) {
    const voice = tiktokVoiceSelect.value;
    const url = `/api/tiktok-tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
    speakViaAudio(url, text);
  }

  function enqueueTTS(user, text) {
    if (!ttsEnabled) return;

    const id = `${user}:${text}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);
    if (seenIds.size > 2000) {
      seenIds.clear();
    }

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
    if (!ttsEnabled || isSpeaking || ttsQueue.length === 0) {
      /* When queue drains, show idle state in media session to keep it alive */
      if (ttsEnabled && !isSpeaking && ttsQueue.length === 0) mediaSessionIdle();
      return;
    }
    isSpeaking = true;

    const next = ttsQueue.shift();
    renderQueue();

    const provider = ttsProvider.value;
    if (provider === 'streamelements') {
      speakStreamElements(next);
      return;
    }
    if (provider === 'google') {
      speakGoogleTranslate(next);
      return;
    }
    if (provider === 'tiktok') {
      speakTikTok(next);
      return;
    }

    const utter = new SpeechSynthesisUtterance(next);
    utter.volume = parseFloat(volumeSlider.value);
    utter.rate   = parseFloat(speedSlider.value);

    const voices = speechSynthesis.getVoices();
    const idx = parseInt(voiceSelect.value, 10);
    if (voices[idx]) utter.voice = voices[idx];

    updateMediaSession(next);

    /* Timeout protection for browser TTS (30s max) */
    const timeout = setTimeout(() => {
      speechSynthesis.cancel();
      isSpeaking = false;
      processQueue();
    }, 30000);

    utter.onend = () => { clearTimeout(timeout); isSpeaking = false; processQueue(); };
    utter.onerror = () => { clearTimeout(timeout); isSpeaking = false; processQueue(); };

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

  /* ---------- Test TTS ---------- */
  testTtsBtn.addEventListener('click', () => {
    const testText = 'Hello! This is a TTS test. Hola, esta es una prueba de voz.';
    const provider = ttsProvider.value;
    if (provider === 'streamelements') {
      const voice = seVoiceSelect.value;
      const url = `/api/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(testText)}`;
      const audio = new Audio(url);
      audio.volume = parseFloat(volumeSlider.value);
      audio.playbackRate = parseFloat(speedSlider.value);
      updateMediaSession(testText);
      audio.play().catch(() => {});
    } else if (provider === 'google') {
      const lang = gttsLangSelect.value;
      const url = `/api/gtts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(testText)}`;
      const audio = new Audio(url);
      audio.volume = parseFloat(volumeSlider.value);
      audio.playbackRate = parseFloat(speedSlider.value);
      updateMediaSession(testText);
      audio.play().catch(() => {});
    } else if (provider === 'tiktok') {
      const voice = tiktokVoiceSelect.value;
      const url = `/api/tiktok-tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(testText)}`;
      const audio = new Audio(url);
      audio.volume = parseFloat(volumeSlider.value);
      audio.playbackRate = parseFloat(speedSlider.value);
      updateMediaSession(testText);
      audio.play().catch(() => {});
    } else {
      const utter = new SpeechSynthesisUtterance(testText);
      utter.volume = parseFloat(volumeSlider.value);
      utter.rate   = parseFloat(speedSlider.value);
      const voices = speechSynthesis.getVoices();
      const idx = parseInt(voiceSelect.value, 10);
      if (voices[idx]) utter.voice = voices[idx];
      updateMediaSession(testText);
      speechSynthesis.speak(utter);
    }
  });

  /* ---------- Controls ---------- */
  speedSlider.addEventListener('input', () => {
    speedValue.textContent = `${parseFloat(speedSlider.value).toFixed(1)}×`;
  });

  filterEnabled.addEventListener('change', () => {
    filterKeywords.disabled = !filterEnabled.checked;
  });

  connectBtn.addEventListener('click', () => {
    const u = usernameInput.value.trim();
    if (u) connectWs(u);
  });

  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connectBtn.click();
  });

  disconnectBtn.addEventListener('click', disconnectWs);

  /* ---------- Keep browser TTS alive in background ---------- */
  setInterval(() => {
    if (ttsProvider.value === 'browser' && speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }, 10000);

  /* ---------- TTS Watchdog: recover from stuck isSpeaking ---------- */
  let stuckCount = 0;
  setInterval(() => {
    if (!ttsEnabled || !isSpeaking) {
      stuckCount = 0;
      return;
    }
    /* Check if audio is actually playing */
    const audioActive = currentAudio && !currentAudio.paused && !currentAudio.ended;
    const synthActive = speechSynthesis.speaking;
    if (audioActive || synthActive) {
      stuckCount = 0;
      return;
    }
    /* isSpeaking is true but nothing is actually playing */
    stuckCount++;
    if (stuckCount >= 2) {
      console.warn('TTS watchdog: forcing recovery from stuck state');
      speechSynthesis.cancel();
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      isSpeaking = false;
      stuckCount = 0;
      processQueue();
    }
  }, 5000);

  /* Keep Service Worker alive with periodic pings */
  setInterval(() => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('keepalive');
    }
  }, 20000);

  /* Resume AudioContext if suspended (e.g. iOS/Android background) */
  document.addEventListener('visibilitychange', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  });

  /* Request wake lock on load if TTS is enabled */
  if (ttsEnabled) {
    requestWakeLock();
    mediaSessionIdle();
  }
})();
