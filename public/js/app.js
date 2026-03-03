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
  const readAllToggle   = $('#readAllToggle');
  const readModsToggle  = $('#readModsToggle');
  const readSubsToggle  = $('#readSubsToggle');
  const readGiftsTTSToggle = $('#readGiftsTTSToggle');

  const ttsProvider     = $('#ttsProvider');
  const browserVoiceGroup = $('#browserVoiceGroup');
  const seVoiceGroup    = $('#seVoiceGroup');
  const seVoiceSelect   = $('#seVoiceSelect');
  const gttsLangGroup   = $('#gttsLangGroup');
  const gttsLangSelect  = $('#gttsLangSelect');
  const tiktokVoiceGroup = $('#tiktokVoiceGroup');
  const tiktokVoiceSelect = $('#tiktokVoiceSelect');
  const edgeVoiceGroup  = $('#edgeVoiceGroup');
  const edgeVoiceSelect = $('#edgeVoiceSelect');
  const testTtsBtn      = $('#testTtsBtn');

  const filterEnabled   = $('#filterEnabled');
  const filterKeywords  = $('#filterKeywords');

  const queueCount      = $('#queueCount');
  const queueList       = $('#queueList');

  const giftGalleryGrid = $('#giftGalleryGrid');
  const giftSearch      = $('#giftSearch');
  const soundLibrary    = $('#soundLibrary');
  const triggersGrid    = $('#triggersGrid');

  /* Sound Browser Modal */
  const soundModal        = $('#soundModal');
  const soundModalClose   = $('#soundModalClose');
  const soundModalSearch  = $('#soundModalSearch');
  const soundModalResults = $('#soundModalResults');
  const soundUploadInput  = $('#soundUploadInput');

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

  /* Gift sound assignments: { key: soundId }
     soundId can be:
       - built-in oscillator id like 'chime', 'ding'
       - MyInstants URL prefixed with 'mi:' like 'mi:https://www.myinstants.com/media/sounds/...'
       - Uploaded sound prefixed with 'up:' like 'up:filename.mp3' */
  const giftSounds = {};

  /* Load saved gift sound assignments from localStorage */
  try {
    const saved = localStorage.getItem('giftSounds');
    if (saved) Object.assign(giftSounds, JSON.parse(saved));
  } catch (e) { console.warn('Failed to load saved gift sounds:', e); }

  function saveGiftSounds() {
    try { localStorage.setItem('giftSounds', JSON.stringify(giftSounds)); } catch {}
  }

  /* Trigger (emote/sticker) registry and sound assignments */
  const triggerRegistry = {}; /* { emoteId: { emoteImageUrl, count } } */
  const triggerSounds = {};
  try {
    const saved = localStorage.getItem('triggerSounds');
    if (saved) Object.assign(triggerSounds, JSON.parse(saved));
  } catch {}
  try {
    const savedTriggers = localStorage.getItem('triggerRegistry');
    if (savedTriggers) Object.assign(triggerRegistry, JSON.parse(savedTriggers));
  } catch {}
  function saveTriggerSounds() {
    try { localStorage.setItem('triggerSounds', JSON.stringify(triggerSounds)); } catch {}
  }
  function saveTriggerRegistry() {
    try { localStorage.setItem('triggerRegistry', JSON.stringify(triggerRegistry)); } catch {}
  }

  /* Uploaded sounds: { 'up:filename.mp3': { name, dataUrl } } */
  const uploadedSounds = {};
  try {
    const saved = localStorage.getItem('uploadedSounds');
    if (saved) Object.assign(uploadedSounds, JSON.parse(saved));
  } catch {}
  function saveUploadedSounds() {
    try { localStorage.setItem('uploadedSounds', JSON.stringify(uploadedSounds)); } catch {}
  }

  /* Currently targeted gift ID for sound modal */
  let soundModalGiftId = null;
  let soundModalTriggerId = null;

  /* Track currently playing preview audio to stop it when a new one plays */
  let currentPreviewAudio = null;
  function stopPreview() {
    if (currentPreviewAudio) {
      currentPreviewAudio.pause();
      currentPreviewAudio.currentTime = 0;
      currentPreviewAudio = null;
    }
  }

  /* Pre-populate gallery from static catalog (loaded from gifts.js) */
  /* Name → key lookup for O(1) matching during live events */
  const giftNameIndex = {};
  const giftIdIndex = {}; /* giftId → registry key for ID-based matching */
  if (typeof GIFT_CATALOG !== 'undefined') {
    GIFT_CATALOG.forEach((g, i) => {
      const key = 'catalog_' + i;
      giftRegistry[key] = { name: g.name, imageUrl: g.image, diamonds: 0, count: 0 };
      giftNameIndex[g.name.toLowerCase()] = key;
      if (g.id) giftIdIndex[String(g.id)] = key;
    });
  }

  /* Load previously learned gifts (gifts seen during past live sessions) */
  try {
    const learned = localStorage.getItem('learnedGifts');
    if (learned) {
      const parsed = JSON.parse(learned);
      Object.entries(parsed).forEach(([gid, g]) => {
        if (!giftRegistry[gid]) {
          giftRegistry[gid] = { name: g.name, imageUrl: g.imageUrl, diamonds: g.diamonds || 0, count: 0 };
        }
        if (g.imageUrl && giftRegistry[gid] && !giftRegistry[gid].imageUrl) {
          giftRegistry[gid].imageUrl = g.imageUrl;
        }
        giftIdIndex[gid] = gid;
        if (g.name) giftNameIndex[g.name.toLowerCase()] = gid;
      });
    }
  } catch {}
  function saveLearnedGifts() {
    /* Save non-catalog gifts that have an image (learned from live events) */
    const learned = {};
    Object.entries(giftRegistry).forEach(([key, g]) => {
      if (!key.startsWith('catalog_') && g.imageUrl) {
        learned[key] = { name: g.name, imageUrl: g.imageUrl, diamonds: g.diamonds };
      }
    });
    try { localStorage.setItem('learnedGifts', JSON.stringify(learned)); } catch {}
  }

  /* ---------- Built-in alert sounds (kept for backward compat with saved assignments) ---------- */
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

  /* Cached popular sounds for gift card dropdowns */
  let cachedPopularSounds = [];

  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playAlertSound(soundId) {
    if (!soundId) return;

    /* Uploaded sound (data URL prefixed with 'up:') */
    if (soundId.startsWith('up:')) {
      const entry = uploadedSounds[soundId];
      if (!entry) return;
      stopPreview();
      const audio = new Audio(entry.dataUrl);
      audio.volume = parseFloat(volumeSlider.value);
      currentPreviewAudio = audio;
      audio.addEventListener('ended', () => { if (currentPreviewAudio === audio) currentPreviewAudio = null; });
      audio.play().catch(() => {});
      return;
    }

    /* MyInstants sound (URL prefixed with 'mi:') */
    if (soundId.startsWith('mi:')) {
      const mp3Url = soundId.slice(3);
      const proxyUrl = `/api/sounds/play?url=${encodeURIComponent(mp3Url)}`;
      stopPreview();
      const audio = new Audio(proxyUrl);
      audio.volume = parseFloat(volumeSlider.value);
      currentPreviewAudio = audio;
      audio.addEventListener('ended', () => { if (currentPreviewAudio === audio) currentPreviewAudio = null; });
      audio.play().catch(() => {});
      return;
    }

    /* Built-in oscillator sound */
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

  /* ---------- Sound Browser Modal ---------- */

  function renderModalSounds(container, sounds, searchQuery) {
    container.innerHTML = '';

    /* Uploaded sounds section (always shown) */
    const uploadKeys = Object.keys(uploadedSounds);
    if (uploadKeys.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'sound-modal-section';
      sec.textContent = '📁 My Uploads';
      container.appendChild(sec);

      const lowerQ = searchQuery ? searchQuery.toLowerCase() : '';
      uploadKeys
        .filter(k => !searchQuery || uploadedSounds[k].name.toLowerCase().includes(lowerQ))
        .forEach(k => {
          const entry = uploadedSounds[k];
          const row = document.createElement('div');
          row.className = 'sound-row sound-upload-item';

          const name = document.createElement('span');
          name.className = 'sound-row-name';
          name.textContent = entry.name;
          row.appendChild(name);

          const playB = document.createElement('button');
          playB.className = 'sound-row-btn play';
          playB.textContent = '▶';
          playB.addEventListener('click', (e) => { e.stopPropagation(); stopPreview(); playAlertSound(k); });
          row.appendChild(playB);

          if (soundModalGiftId) {
            const useB = document.createElement('button');
            useB.className = 'sound-row-btn use';
            useB.textContent = '✓ Use';
            useB.addEventListener('click', (e) => {
              e.stopPropagation();
              giftSounds[soundModalGiftId] = k;
              saveGiftSounds();
              closeSoundModal();
              renderGiftGallery(giftSearch.value);
            });
            row.appendChild(useB);
          } else if (soundModalTriggerId) {
            const useB = document.createElement('button');
            useB.className = 'sound-row-btn use';
            useB.textContent = '✓ Use';
            useB.addEventListener('click', (e) => {
              e.stopPropagation();
              triggerSounds[soundModalTriggerId] = k;
              saveTriggerSounds();
              closeSoundModal();
              renderTriggers();
            });
            row.appendChild(useB);
          }

          const delB = document.createElement('button');
          delB.className = 'sound-row-btn del';
          delB.textContent = '✕';
          delB.addEventListener('click', (e) => {
            e.stopPropagation();
            delete uploadedSounds[k];
            saveUploadedSounds();
            renderModalSounds(container, sounds, searchQuery);
          });
          row.appendChild(delB);

          container.appendChild(row);
        });
    }

    /* Popular / search results */
    if (sounds && sounds.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'sound-modal-section';
      sec.textContent = searchQuery ? '🔍 Search Results' : '🔥 Popular Sounds';
      container.appendChild(sec);

      sounds.forEach(s => {
        const row = document.createElement('div');
        row.className = 'sound-row';

        const name = document.createElement('span');
        name.className = 'sound-row-name';
        name.textContent = s.title;
        row.appendChild(name);

        const playB = document.createElement('button');
        playB.className = 'sound-row-btn play';
        playB.textContent = '▶';
        playB.addEventListener('click', (e) => {
          e.stopPropagation();
          stopPreview();
          const proxyUrl = `/api/sounds/play?url=${encodeURIComponent(s.mp3)}`;
          const audio = new Audio(proxyUrl);
          audio.volume = parseFloat(volumeSlider.value);
          currentPreviewAudio = audio;
          audio.addEventListener('ended', () => { if (currentPreviewAudio === audio) currentPreviewAudio = null; });
          audio.play().catch(() => {});
        });
        row.appendChild(playB);

        if (soundModalGiftId) {
          const useB = document.createElement('button');
          useB.className = 'sound-row-btn use';
          useB.textContent = '✓ Use';
          useB.addEventListener('click', (e) => {
            e.stopPropagation();
            const soundKey = 'mi:' + s.mp3;
            giftSounds[soundModalGiftId] = soundKey;
            try { localStorage.setItem('miName:' + soundKey, s.title); } catch {}
            saveGiftSounds();
            closeSoundModal();
            renderGiftGallery(giftSearch.value);
          });
          row.appendChild(useB);
        } else if (soundModalTriggerId) {
          const useB = document.createElement('button');
          useB.className = 'sound-row-btn use';
          useB.textContent = '✓ Use';
          useB.addEventListener('click', (e) => {
            e.stopPropagation();
            const soundKey = 'mi:' + s.mp3;
            triggerSounds[soundModalTriggerId] = soundKey;
            try { localStorage.setItem('miName:' + soundKey, s.title); } catch {}
            saveTriggerSounds();
            closeSoundModal();
            renderTriggers();
          });
          row.appendChild(useB);
        }

        container.appendChild(row);
      });
    } else if (!uploadKeys.length) {
      container.innerHTML = '<div class="mi-loading">No sounds found.</div>';
    }
  }

  /* Shared helper: fetch popular sounds (used by modal and startup) */
  function loadPopularSounds() {
    return fetch('/api/sounds/popular')
      .then(r => r.json())
      .then(data => {
        cachedPopularSounds = Array.isArray(data) ? data : [];
        return cachedPopularSounds;
      })
      .catch(() => cachedPopularSounds);
  }

  function openSoundModal(giftId, triggerId) {
    soundModalGiftId = giftId || null;
    soundModalTriggerId = triggerId || null;
    soundModal.classList.remove('hidden');
    soundModalSearch.value = '';
    /* Show popular sounds by default */
    if (cachedPopularSounds.length > 0) {
      renderModalSounds(soundModalResults, cachedPopularSounds, '');
    } else {
      soundModalResults.innerHTML = '<div class="mi-loading">Loading sounds…</div>';
      loadPopularSounds().then(sounds => {
        renderModalSounds(soundModalResults, sounds, '');
      });
    }
    soundModalSearch.focus();
  }

  function closeSoundModal() {
    stopPreview();
    soundModal.classList.add('hidden');
    soundModalGiftId = null;
    soundModalTriggerId = null;
  }

  soundModalClose.addEventListener('click', closeSoundModal);
  soundModal.addEventListener('click', (e) => {
    if (e.target === soundModal) closeSoundModal();
  });

  /* Search within modal */
  let modalSearchTimeout = null;
  soundModalSearch.addEventListener('input', () => {
    clearTimeout(modalSearchTimeout);
    const q = soundModalSearch.value.trim();

    if (!q) {
      renderModalSounds(soundModalResults, cachedPopularSounds, '');
      return;
    }

    /* Immediate local filter */
    const local = cachedPopularSounds.filter(s =>
      s.title.toLowerCase().includes(q.toLowerCase())
    );
    renderModalSounds(soundModalResults, local, q);

    /* Try server search for more */
    modalSearchTimeout = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/sounds/search?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        if (!data.error) {
          const arr = Array.isArray(data) ? data : [];
          if (arr.length > 0) renderModalSounds(soundModalResults, arr, q);
        }
      } catch { /* keep local */ }
    }, 400);
  });

  /* Upload handler */
  soundUploadInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('audio/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const key = 'up:' + Date.now() + '_' + file.name;
        uploadedSounds[key] = { name: file.name, dataUrl: reader.result };
        saveUploadedSounds();
        /* Refresh modal if open */
        if (!soundModal.classList.contains('hidden')) {
          const q = soundModalSearch.value.trim();
          const sounds = q
            ? cachedPopularSounds.filter(s => s.title.toLowerCase().includes(q.toLowerCase()))
            : cachedPopularSounds;
          renderModalSounds(soundModalResults, sounds, q);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  /* Sound Library section in Gifts tab — just shows popular sounds */
  function renderSoundLibrary() {
    soundLibrary.innerHTML = '';
    const openBtn = document.createElement('button');
    openBtn.textContent = '🔊 Open Sound Browser';
    openBtn.style.cssText = 'width:100%;padding:12px;border:none;border-radius:12px;background:var(--accent);color:#fff;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px';
    openBtn.addEventListener('click', () => openSoundModal(null));
    soundLibrary.appendChild(openBtn);
  }

  /* Load popular sounds on startup */
  loadPopularSounds();

  renderSoundLibrary();
  renderGiftGallery();
  renderTriggers();

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
    edgeVoiceGroup.classList.toggle('hidden', val !== 'edge');
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
    /* Stop all TTS on disconnect */
    speechSynthesis.cancel();
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    ttsQueue.length = 0;
    isSpeaking = false;
    renderQueue();
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
          enqueueTTS(msg.user, msg.comment, 'chat', msg.isModerator, msg.isSubscriber);
        }
        break;
      case 'gift':
        if (toggleGift.checked) {
          /* Try to resolve gift image from catalog/learned gifts if server didn't provide one */
          let resolvedPictureUrl = msg.giftPictureUrl || '';
          let resolvedName = msg.giftName;
          if (!resolvedPictureUrl) {
            const idStr = msg.giftId ? String(msg.giftId) : null;
            const byId = idStr ? giftIdIndex[idStr] : null;
            const byName = msg.giftName ? giftNameIndex[msg.giftName.toLowerCase()] : null;
            const regKey = byId || byName || idStr;
            if (regKey && giftRegistry[regKey]) {
              resolvedPictureUrl = giftRegistry[regKey].imageUrl || '';
              if (resolvedName.startsWith('Gift #')) resolvedName = giftRegistry[regKey].name;
            }
          }
          appendGiftMessage(msg.user, resolvedName, msg.repeatCount, msg.diamondCount, resolvedPictureUrl, msg.profilePictureUrl);
          /* Only TTS-read when repeatEnd is true (combo finished or single gift) */
          if (readGiftsTTSToggle.checked && msg.repeatEnd) {
            const giftText = msg.repeatCount > 1
              ? `${msg.user} envió un combo de ${resolvedName}`
              : `${msg.user} envió ${resolvedName}`;
            enqueueTTS(msg.user, giftText, 'gift');
          }
          registerGift(msg.giftId, resolvedName, resolvedPictureUrl || msg.giftPictureUrl, msg.diamondCount, msg.repeatCount, msg.repeatEnd);
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
      case 'emote':
        registerTrigger(msg.emoteId, msg.emoteImageUrl, msg.user);
        break;
      case 'fan_stickers':
        /* Pre-populate triggers from stickers found on connect */
        if (Array.isArray(msg.stickers)) {
          msg.stickers.forEach(s => {
            if (!s.emoteId) return;
            const key = String(s.emoteId);
            if (!triggerRegistry[key]) {
              triggerRegistry[key] = { emoteImageUrl: s.emoteImageUrl || '', count: 0, label: s.label || '' };
            } else if (s.emoteImageUrl && !triggerRegistry[key].emoteImageUrl) {
              triggerRegistry[key].emoteImageUrl = s.emoteImageUrl;
            }
          });
          saveTriggerRegistry();
          renderTriggers();
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
  function registerGift(giftId, name, imageUrl, diamonds, count, repeatEnd) {
    if (!giftId && !name) return;

    const idStr = giftId ? String(giftId) : null;
    let key = null;

    /* 1. Try matching by giftId first (most reliable) */
    if (idStr && giftIdIndex[idStr]) {
      key = giftIdIndex[idStr];
    }
    /* 2. Fall back to name-based matching */
    if (!key && name) {
      const catalogKey = giftNameIndex[name.toLowerCase()];
      if (catalogKey) key = catalogKey;
    }
    /* 3. Use existing registry entry by raw ID */
    if (!key && idStr && giftRegistry[idStr]) {
      key = idStr;
    }
    /* 4. Create new entry for unknown gift */
    if (!key) {
      key = idStr || ('unknown_' + (name || Date.now()));
      giftRegistry[key] = { name: name || `Gift #${giftId}`, imageUrl: imageUrl || '', diamonds: diamonds || 0, count: 0 };
    }

    /* Update existing entry with live data */
    giftRegistry[key].count += (count || 1);
    if (imageUrl && imageUrl.startsWith('http')) giftRegistry[key].imageUrl = imageUrl;
    else if (imageUrl && !giftRegistry[key].imageUrl) giftRegistry[key].imageUrl = imageUrl;
    if (diamonds) giftRegistry[key].diamonds = diamonds;
    if (name && giftRegistry[key].name.startsWith('Gift #')) giftRegistry[key].name = name;

    /* Link giftId to this key for future lookups */
    if (idStr) {
      giftIdIndex[idStr] = key;
      if (name) giftNameIndex[name.toLowerCase()] = key;
    }

    /* Persist learned gifts that have images for future sessions */
    if (imageUrl && imageUrl.startsWith('http')) {
      saveLearnedGifts();
    }

    const assignedSound = giftSounds[key];
    if (assignedSound && repeatEnd !== false) {
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
    const popularKeys = new Set(cachedPopularSounds.map(s => 'mi:' + s.mp3));
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

      /* Sound assignment: built-in sounds dropdown */
      const sel = document.createElement('select');
      sel.dataset.gid = gid;
      const noOpt = document.createElement('option');
      noOpt.value = '';
      noOpt.textContent = 'No sound';
      sel.appendChild(noOpt);

      /* Add popular sounds group (from MyInstants) */
      const currentSound = giftSounds[gid];
      if (cachedPopularSounds.length > 0) {
        const popGroup = document.createElement('optgroup');
        popGroup.label = '🔥 Popular';
        cachedPopularSounds.forEach(s => {
          const opt = document.createElement('option');
          const soundKey = 'mi:' + s.mp3;
          opt.value = soundKey;
          opt.textContent = s.title;
          if (currentSound === soundKey) opt.selected = true;
          popGroup.appendChild(opt);
        });
        sel.appendChild(popGroup);
      }

      /* If a MyInstants sound is assigned that's not in popular, show it as option */
      if (currentSound && currentSound.startsWith('mi:') && !popularKeys.has(currentSound)) {
        const miGroup = document.createElement('optgroup');
        miGroup.label = '🌐 MyInstants';
        const miOpt = document.createElement('option');
        miOpt.value = currentSound;
        const savedName = localStorage.getItem('miName:' + currentSound) || 'Custom sound';
        miOpt.textContent = `🔊 ${savedName}`;
        miOpt.selected = true;
        miGroup.appendChild(miOpt);
        sel.appendChild(miGroup);
      }

      /* Backward compat: if a built-in oscillator sound is assigned, show it */
      if (currentSound && !currentSound.startsWith('mi:')) {
        const legacyGroup = document.createElement('optgroup');
        legacyGroup.label = '🎵 Legacy';
        const ls = ALERT_SOUNDS.find(a => a.id === currentSound);
        if (ls) {
          const opt = document.createElement('option');
          opt.value = ls.id;
          opt.textContent = ls.name;
          opt.selected = true;
          legacyGroup.appendChild(opt);
          sel.appendChild(legacyGroup);
        }
      }

      card.appendChild(sel);

      /* Button row: Test + Search MyInstants */
      const btnRow = document.createElement('div');
      btnRow.className = 'gift-btn-row';

      const testBtn = document.createElement('button');
      testBtn.className = 'btn-play-sound';
      testBtn.textContent = '▶ Test';
      btnRow.appendChild(testBtn);

      const searchSoundBtn = document.createElement('button');
      searchSoundBtn.className = 'btn-search-sound';
      searchSoundBtn.textContent = '🔍 Sound';
      btnRow.appendChild(searchSoundBtn);

      card.appendChild(btnRow);

      /* Event handlers */
      sel.addEventListener('change', () => {
        if (sel.value) {
          giftSounds[gid] = sel.value;
        } else {
          delete giftSounds[gid];
        }
        saveGiftSounds();
      });

      testBtn.addEventListener('click', () => {
        const sid = giftSounds[gid] || sel.value;
        if (sid) playAlertSound(sid);
      });

      searchSoundBtn.addEventListener('click', () => {
        openSoundModal(gid);
      });

      giftGalleryGrid.appendChild(card);
    });
  }

  /* ---------- Triggers (Emotes/Stickers) ---------- */
  function registerTrigger(emoteId, emoteImageUrl, user) {
    if (!emoteId) return;
    const key = String(emoteId);
    if (triggerRegistry[key]) {
      triggerRegistry[key].count += 1;
      if (emoteImageUrl) triggerRegistry[key].emoteImageUrl = emoteImageUrl;
    } else {
      triggerRegistry[key] = { emoteImageUrl: emoteImageUrl || '', count: 1 };
    }
    saveTriggerRegistry();
    /* Play assigned sound */
    const assignedSound = triggerSounds[key];
    if (assignedSound) playAlertSound(assignedSound);
    renderTriggers();
  }

  function renderTriggers() {
    const keys = Object.keys(triggerRegistry);
    if (keys.length === 0) {
      triggersGrid.innerHTML = '<div class="gift-empty">Los stickers del fan club se cargan automáticamente al conectarse. También se guardan cuando los viewers los usan.</div>';
      return;
    }
    triggersGrid.innerHTML = '';
    const popularKeys = new Set(cachedPopularSounds.map(s => 'mi:' + s.mp3));
    keys.forEach(tid => {
      const t = triggerRegistry[tid];
      const card = document.createElement('div');
      card.className = 'gift-card trigger-card';

      if (t.emoteImageUrl) {
        const img = document.createElement('img');
        img.src = t.emoteImageUrl;
        img.alt = 'Emote';
        img.onerror = function () { this.src = ''; };
        card.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'width:56px;height:56px;background:var(--surface2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;';
        placeholder.textContent = '🎭';
        card.appendChild(placeholder);
      }

      const nameDiv = document.createElement('div');
      nameDiv.className = 'gift-card-name';
      nameDiv.textContent = t.label || `Emote #${tid}`;
      card.appendChild(nameDiv);

      if (t.count > 0) {
        const countDiv = document.createElement('div');
        countDiv.className = 'gift-card-count';
        countDiv.textContent = `Sent: ${t.count}×`;
        card.appendChild(countDiv);
      }

      /* Sound assignment dropdown */
      const sel = document.createElement('select');
      const noOpt = document.createElement('option');
      noOpt.value = '';
      noOpt.textContent = 'No sound';
      sel.appendChild(noOpt);

      const currentSound = triggerSounds[tid];
      if (cachedPopularSounds.length > 0) {
        const popGroup = document.createElement('optgroup');
        popGroup.label = '🔥 Popular';
        cachedPopularSounds.forEach(s => {
          const opt = document.createElement('option');
          const soundKey = 'mi:' + s.mp3;
          opt.value = soundKey;
          opt.textContent = s.title;
          if (currentSound === soundKey) opt.selected = true;
          popGroup.appendChild(opt);
        });
        sel.appendChild(popGroup);
      }

      if (currentSound && currentSound.startsWith('mi:') && !popularKeys.has(currentSound)) {
        const miGroup = document.createElement('optgroup');
        miGroup.label = '🌐 MyInstants';
        const miOpt = document.createElement('option');
        miOpt.value = currentSound;
        const savedName = localStorage.getItem('miName:' + currentSound) || 'Custom sound';
        miOpt.textContent = `🔊 ${savedName}`;
        miOpt.selected = true;
        miGroup.appendChild(miOpt);
        sel.appendChild(miGroup);
      }

      card.appendChild(sel);

      const btnRow = document.createElement('div');
      btnRow.className = 'gift-btn-row';

      const testBtn = document.createElement('button');
      testBtn.className = 'btn-play-sound';
      testBtn.textContent = '▶ Test';
      btnRow.appendChild(testBtn);

      const searchSoundBtn = document.createElement('button');
      searchSoundBtn.className = 'btn-search-sound';
      searchSoundBtn.textContent = '🔍 Sound';
      btnRow.appendChild(searchSoundBtn);

      card.appendChild(btnRow);

      sel.addEventListener('change', () => {
        if (sel.value) {
          triggerSounds[tid] = sel.value;
        } else {
          delete triggerSounds[tid];
        }
        saveTriggerSounds();
      });

      testBtn.addEventListener('click', () => {
        const sid = triggerSounds[tid] || sel.value;
        if (sid) playAlertSound(sid);
      });

      searchSoundBtn.addEventListener('click', () => {
        openSoundModal(null, tid);
      });

      triggersGrid.appendChild(card);
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
      artist: 'Lively',
      album: currentUsername ? `@${currentUsername}` : 'Live Stream'
    });
    navigator.mediaSession.playbackState = 'playing';
  }

  /* Show idle state in media session when queue drains */
  function mediaSessionIdle() {
    if (!('mediaSession' in navigator) || !ttsEnabled) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Waiting for messages…',
      artist: 'Lively',
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

  function speakEdgeTTS(text) {
    const voice = edgeVoiceSelect.value;
    const url = `/api/edge-tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
    speakViaAudio(url, text);
  }

  function enqueueTTS(user, text, eventType = 'chat', isModerator = false, isSubscriber = false) {
    if (!ttsEnabled) return;

    /* Role-based filter: skip chat messages that don't match enabled roles */
    if (eventType === 'chat') {
      if (!readAllToggle.checked) {
        const allowMod = readModsToggle.checked && isModerator;
        const allowSub = readSubsToggle.checked && isSubscriber;
        if (!allowMod && !allowSub) return;
      }
    }

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

    let label;
    if (eventType === 'gift') {
      label = text;
    } else {
      label = readUsernameToggle.checked ? `${user} says: ${text}` : text;
    }
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
    if (provider === 'edge') {
      speakEdgeTTS(next);
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
    } else if (provider === 'edge') {
      const voice = edgeVoiceSelect.value;
      const url = `/api/edge-tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(testText)}`;
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
