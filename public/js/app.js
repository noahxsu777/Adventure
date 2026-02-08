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
  const testTtsBtn      = $('#testTtsBtn');

  const filterEnabled   = $('#filterEnabled');
  const filterKeywords  = $('#filterKeywords');

  const queueCount      = $('#queueCount');
  const queueList       = $('#queueList');

  const giftGalleryGrid = $('#giftGalleryGrid');
  const soundLibrary    = $('#soundLibrary');

  const connectionOverlay = $('#connectionOverlay');
  const connectionSteps   = $('#connectionSteps');

  /* ---------- State ---------- */
  let ws = null;
  let ttsQueue = [];
  let isSpeaking = false;
  let ttsEnabled = false;
  let userDisconnected = false;
  let currentUsername = '';
  let currentAudio = null;            // track current Audio element for background playback
  const MAX_CHAT_ITEMS = 300;
  const seenIds = new Set();
  const RECONNECT_DELAY = 3000;

  /* Gift gallery: { giftId: { name, imageUrl, diamonds, count } } */
  const giftRegistry = {};

  /* Gift sound assignments: { giftId: soundId } */
  const giftSounds = {};

  /* ---------- Built-in alert sounds (generated via AudioContext) ---------- */
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

  /* ---------- TTS Provider switching ---------- */
  ttsProvider.addEventListener('change', () => {
    const val = ttsProvider.value;
    browserVoiceGroup.classList.toggle('hidden', val !== 'browser');
    seVoiceGroup.classList.toggle('hidden', val !== 'streamelements');
    gttsLangGroup.classList.toggle('hidden', val !== 'googletranslate');
  });

  /* ---------- TTS Toggle ---------- */
  ttsToggleBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    ttsToggleBtn.classList.toggle('active', ttsEnabled);
    ttsToggleBtn.textContent = ttsEnabled ? '🔊 Chat TTS Active' : '🔇 Enable Chat TTS';
    if (!ttsEnabled) {
      speechSynthesis.cancel();
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      ttsQueue.length = 0;
      isSpeaking = false;
      renderQueue();
    }
  });

  /* ---------- Connection Status Overlay ---------- */
  function showConnectionOverlay() {
    connectionSteps.innerHTML = '';
    connectionOverlay.classList.remove('hidden');
  }

  function hideConnectionOverlay() {
    connectionOverlay.classList.add('hidden');
  }

  function addConnectionStep(message, state) {
    /* state: 'active', 'done', 'error' */
    /* Mark previous active steps as done */
    connectionSteps.querySelectorAll('.connection-step.active').forEach(el => {
      el.classList.remove('active');
      el.classList.add('done');
    });

    const step = document.createElement('div');
    step.className = `connection-step ${state}`;
    step.innerHTML = `<div class="connection-step-dot"></div><span>${message}</span>`;
    connectionSteps.appendChild(step);

    /* Auto-hide on success or error after a delay */
    if (state === 'done' || state === 'error') {
      setTimeout(hideConnectionOverlay, state === 'done' ? 1500 : 3000);
    }
  }

  /* ---------- WebSocket with auto-reconnect ---------- */
  function connectWs(username) {
    currentUsername = username;
    userDisconnected = false;

    showConnectionOverlay();
    addConnectionStep('🌐 Connecting to server…', 'active');

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.addEventListener('open', () => {
      addConnectionStep('✅ Server connected!', 'done');
      ws.send(JSON.stringify({ type: 'connect', username }));
      setStatus('connecting');
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      handleEvent(msg);
    });

    ws.addEventListener('close', () => {
      if (!userDisconnected && currentUsername) {
        setStatus('reconnecting');
        setTimeout(() => {
          if (!userDisconnected && currentUsername) {
            connectWs(currentUsername);
          }
        }, RECONNECT_DELAY);
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
    hideConnectionOverlay();
    if (ws) {
      try { ws.send(JSON.stringify({ type: 'disconnect' })); } catch {}
      ws.close();
      ws = null;
    }
    setStatus('offline');
  }

  function setStatus(s) {
    if (s === 'online') {
      statusBadge.textContent = 'Live';
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
        /* Animated connection steps from server */
        if (msg.step === 'success') {
          addConnectionStep(msg.message, 'done');
        } else if (msg.step === 'error') {
          addConnectionStep(msg.message, 'error');
        } else {
          addConnectionStep(msg.message, 'active');
        }
        break;
      case 'connected':
        setStatus('online');
        break;
      case 'disconnected':
        if (!userDisconnected && currentUsername) {
          appendSystem('Stream disconnected. Reconnecting…');
          if (ws) { ws.close(); ws = null; }
        }
        break;
      case 'error':
        if (userDisconnected || !currentUsername) {
          appendSystem(`Error: ${msg.message}`);
        }
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
    if (!giftId) return;
    if (giftRegistry[giftId]) {
      giftRegistry[giftId].count += (count || 1);
    } else {
      giftRegistry[giftId] = { name, imageUrl, diamonds, count: count || 1 };
    }

    const assignedSound = giftSounds[giftId];
    if (assignedSound) {
      playAlertSound(assignedSound);
    }

    renderGiftGallery();
  }

  function renderGiftGallery() {
    const ids = Object.keys(giftRegistry);
    if (ids.length === 0) {
      giftGalleryGrid.innerHTML = '<div class="gift-empty">Connect to a live stream to see gifts here.</div>';
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
        placeholder.style.cssText = 'width:64px;height:64px;background:var(--surface2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem;';
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

      const countDiv = document.createElement('div');
      countDiv.className = 'gift-card-count';
      countDiv.textContent = `Received: ${g.count}×`;
      card.appendChild(countDiv);

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

  /* --- Audio-based TTS (works in background on Android) --- */
  function speakViaAudio(url) {
    const audio = new Audio(url);
    currentAudio = audio;
    audio.volume = parseFloat(volumeSlider.value);
    audio.playbackRate = parseFloat(speedSlider.value);
    audio.onended = () => { currentAudio = null; isSpeaking = false; processQueue(); };
    audio.onerror = () => { currentAudio = null; isSpeaking = false; processQueue(); };
    audio.play().catch(() => { currentAudio = null; isSpeaking = false; processQueue(); });
  }

  function speakStreamElements(text) {
    const voice = seVoiceSelect.value;
    const url = `/api/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
    speakViaAudio(url);
  }

  function speakGoogleTranslate(text) {
    const lang = gttsLangSelect.value;
    const url = `/api/gtts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`;
    speakViaAudio(url);
  }

  function enqueueTTS(user, text, eventType) {
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
    if (!ttsEnabled || isSpeaking || ttsQueue.length === 0) return;
    isSpeaking = true;

    const next = ttsQueue.shift();
    renderQueue();

    const provider = ttsProvider.value;
    if (provider === 'streamelements') {
      speakStreamElements(next);
      return;
    }
    if (provider === 'googletranslate') {
      speakGoogleTranslate(next);
      return;
    }

    /* Browser TTS (may not work in background on Android) */
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
      audio.play().catch(() => {});
    } else if (provider === 'googletranslate') {
      const lang = gttsLangSelect.value;
      const url = `/api/gtts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(testText)}`;
      const audio = new Audio(url);
      audio.volume = parseFloat(volumeSlider.value);
      audio.playbackRate = parseFloat(speedSlider.value);
      audio.play().catch(() => {});
    } else {
      const utter = new SpeechSynthesisUtterance(testText);
      utter.volume = parseFloat(volumeSlider.value);
      utter.rate   = parseFloat(speedSlider.value);
      const voices = speechSynthesis.getVoices();
      const idx = parseInt(voiceSelect.value, 10);
      if (voices[idx]) utter.voice = voices[idx];
      speechSynthesis.speak(utter);
    }
  });

  /* ---------- Other controls ---------- */
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
  /* For browser TTS: periodic nudge prevents Chrome from throttling */
  setInterval(() => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }, 10000);

  /* For Audio-based TTS: resume AudioContext if suspended (Android) */
  document.addEventListener('visibilitychange', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  });
})();
