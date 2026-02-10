const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));
app.use(express.json());

app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));

/* Proxy StreamElements TTS to avoid CORS issues */
const SE_VOICES = new Set([
  'Brian','Amy','Emma','Geraint','Russell','Nicole','Joey','Justin','Matthew',
  'Ivy','Joanna','Kendra','Kimberly','Salli','Raveena','Aditi','Zhiyu',
  'Mads','Naja','Ruben','Lotte','Lea','Celine','Mathieu','Hans','Marlene',
  'Vicki','Conchita','Enrique','Miguel','Penelope','Lucia','Mia','Giorgio',
  'Carla','Bianca','Takumi','Mizuki','Seoyeon','Liv','Ewa','Jacek','Jan',
  'Maja','Ricardo','Vitoria','Camila','Cristiano','Ines','Carmen','Maxim',
  'Tatyana','Astrid','Filiz','Gwyneth'
]);

app.get('/api/tts', async (req, res) => {
  const { voice, text } = req.query;
  if (!text) return res.status(400).send('Missing text');
  const safeName = SE_VOICES.has(voice) ? voice : 'Brian';
  try {
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(safeName)}&text=${encodeURIComponent(text)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`SE API ${resp.status}`);
    res.set('Content-Type', 'audio/mpeg');
    const buffer = await resp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).send('TTS proxy error: ' + err.message);
  }
});

/* Google Translate TTS proxy — free, no registration */
const GTTS_LANGS = new Set([
  'en','es','pt','fr','de','it','ja','ko','zh-CN','zh-TW','ru','ar','hi',
  'nl','pl','sv','tr','da','nb','fi','el','cs','ro','hu','th','vi','id','ms'
]);

app.get('/api/gtts', async (req, res) => {
  const { text, lang } = req.query;
  if (!text) return res.status(400).send('Missing text');
  const safeLang = GTTS_LANGS.has(lang) ? lang : 'en';
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(safeLang)}&client=tw-ob&q=${encodeURIComponent(text.slice(0, 200))}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!resp.ok) throw new Error(`Google TTS ${resp.status}`);
    res.set('Content-Type', 'audio/mpeg');
    const buffer = await resp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).send('Google TTS proxy error: ' + err.message);
  }
});

/* TikTok TTS proxy — uses the same endpoint TikTok uses for text-to-speech */
const TIKTOK_VOICES = new Set([
  'en_us_001','en_us_006','en_us_007','en_us_009','en_us_010',
  'en_uk_001','en_uk_003','en_au_001','en_au_002',
  'es_002','es_mx_002','fr_001','fr_002','de_001','de_002',
  'it_male_m18','pt_br_001','pt_br_003',
  'jp_001','jp_006','kr_002','kr_003','id_001'
]);

app.get('/api/tiktok-tts', async (req, res) => {
  const { voice, text } = req.query;
  if (!text) return res.status(400).send('Missing text');
  const safeVoice = TIKTOK_VOICES.has(voice) ? voice : 'en_us_001';
  const TIKTOK_MAX_TEXT_LENGTH = 300; /* TikTok API limitation */

  try {
    const url = `https://tiktok-tts.weilnet.workers.dev/api/generation`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, TIKTOK_MAX_TEXT_LENGTH), voice: safeVoice })
    });
    if (!resp.ok) throw new Error(`TikTok TTS ${resp.status}`);
    const json = await resp.json();
    if (!json.data) throw new Error('No audio data returned');
    const audioBuffer = Buffer.from(json.data, 'base64');
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    res.status(502).send('TikTok TTS proxy error: ' + err.message);
  }
});

/* ============================================================
   MyInstants Sound Effects — search & proxy
   ============================================================ */

/**
 * Scrape MyInstants search results.
 * Returns [{ title, slug, mp3 }]
 */
async function searchMyInstants(query, page = 1) {
  const url = `https://www.myinstants.com/en/search/?name=${encodeURIComponent(query)}&page=${page}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!resp.ok) throw new Error(`MyInstants ${resp.status}`);
  const html = await resp.text();

  const results = [];
  /* Match each instant button: <button class="small-button" ... onclick="play('media/sounds/filename.mp3'...)">
     and its title from <a> tags nearby */
  const buttonRegex = /onclick="play\('\/media\/sounds\/([^']+)'/g;
  const titleRegex = /<a[^>]+class="instant-link"[^>]*>([^<]+)<\/a>/g;

  const buttons = [];
  let m;
  while ((m = buttonRegex.exec(html)) !== null) {
    buttons.push(m[1]);
  }

  const titles = [];
  while ((m = titleRegex.exec(html)) !== null) {
    titles.push(m[1].trim());
  }

  if (buttons.length !== titles.length) {
    console.warn(`MyInstants scrape mismatch: ${buttons.length} buttons vs ${titles.length} titles`);
  }

  for (let i = 0; i < buttons.length && i < titles.length; i++) {
    results.push({
      title: titles[i],
      mp3: `https://www.myinstants.com/media/sounds/${buttons[i]}`
    });
  }

  return results;
}

app.get('/api/sounds/search', async (req, res) => {
  const { q, page } = req.query;
  if (!q || q.length < 1) return res.json([]);
  try {
    const results = await searchMyInstants(q, parseInt(page) || 1);
    res.json(results);
  } catch (err) {
    console.error('MyInstants search error:', err.message);
    res.status(502).json({ error: 'Sound search failed: ' + err.message });
  }
});

/* Proxy MyInstants MP3 to avoid CORS */
app.get('/api/sounds/play', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');

  /* Only allow myinstants.com URLs */
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'www.myinstants.com' && parsed.hostname !== 'myinstants.com') {
      return res.status(403).send('Only myinstants.com URLs allowed');
    }
    if (!parsed.pathname.startsWith('/media/sounds/')) {
      return res.status(403).send('Invalid sound path');
    }
  } catch {
    return res.status(400).send('Invalid URL');
  }

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!resp.ok) throw new Error(`MP3 fetch ${resp.status}`);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    const buffer = await resp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).send('Sound proxy error: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;

/** Track active TikTok connections per WebSocket client */
const clients = new Map();

function broadcast(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'connect') {
      const username = (msg.username || '').trim();
      if (!username) {
        broadcast(ws, 'error', { message: 'Username is required' });
        return;
      }

      /* Disconnect previous connection if any */
      const prev = clients.get(ws);
      if (prev) {
        if (prev.reconnectTimer) clearTimeout(prev.reconnectTimer);
        try { prev.connection.disconnect(); } catch {}
        clients.delete(ws);
      }

      import('tiktok-live-connector').then(({ TikTokLiveConnection, WebcastEvent, UserOfflineError }) => {

        function createAndConnect() {
          const connection = new TikTokLiveConnection(username, {
            processInitialData: false,
            enableExtendedGiftInfo: true
          });

          /* Store connection + metadata for this client */
          clients.set(ws, { connection, username, reconnectTimer: null });

          connection.connect()
            .then((state) => {
              console.log(`Connected to ${username} (roomId ${state.roomId})`);
              reconnectDelay = 5000; /* reset backoff on success */
              broadcast(ws, 'connected', { username, roomId: state.roomId });
            })
            .catch((err) => {
              console.error('Connection failed:', err.message);
              /* Translate known errors to Spanish */
              let errorMsg = err.message;
              if (UserOfflineError && err instanceof UserOfflineError) {
                errorMsg = 'El usuario no está en LIVE :(';
              }
              broadcast(ws, 'error', { message: errorMsg });
              /* Auto-retry after failure unless user disconnected */
              scheduleReconnect();
            });

          connection.on(WebcastEvent.CHAT, (data) => {
            broadcast(ws, 'chat', {
              user: data.user?.uniqueId || 'unknown',
              nickname: data.user?.nickname || '',
              comment: data.comment || '',
              profilePictureUrl: data.user?.profilePictureUrl || ''
            });
          });

          connection.on(WebcastEvent.GIFT, (data) => {
            broadcast(ws, 'gift', {
              user: data.user?.uniqueId || 'unknown',
              nickname: data.user?.nickname || '',
              giftId: data.giftId,
              giftName: data.giftName || data.extendedGiftInfo?.name || `Gift #${data.giftId}`,
              giftPictureUrl: data.giftPictureUrl || data.extendedGiftInfo?.image?.url_list?.[0] || '',
              diamondCount: data.diamondCount || data.extendedGiftInfo?.diamond_count || 0,
              repeatCount: data.repeatCount || 1,
              profilePictureUrl: data.user?.profilePictureUrl || ''
            });
          });

          connection.on(WebcastEvent.LIKE, (data) => {
            broadcast(ws, 'like', {
              user: data.user?.uniqueId || 'unknown',
              nickname: data.user?.nickname || '',
              likeCount: data.likeCount || 1,
              profilePictureUrl: data.user?.profilePictureUrl || ''
            });
          });

          connection.on(WebcastEvent.FOLLOW, (data) => {
            broadcast(ws, 'follow', {
              user: data.user?.uniqueId || 'unknown',
              nickname: data.user?.nickname || '',
              profilePictureUrl: data.user?.profilePictureUrl || ''
            });
          });

          connection.on(WebcastEvent.MEMBER, (data) => {
            broadcast(ws, 'member', {
              user: data.user?.uniqueId || 'unknown',
              nickname: data.user?.nickname || '',
              profilePictureUrl: data.user?.profilePictureUrl || ''
            });
          });

          /* Server-side auto-reconnect: keep connection alive */
          connection.on('disconnected', () => {
            console.log(`TikTok disconnected for ${username}, will auto-reconnect server-side`);
            broadcast(ws, 'tiktok_reconnecting', { message: 'Stream interrupted, reconnecting…' });
            scheduleReconnect();
          });

          connection.on('error', (err) => {
            console.error(`TikTok error for ${username}:`, err.message);
          });
        }

        let reconnectDelay = 5000;
        const MAX_DELAY = 60000;

        function scheduleReconnect() {
          const entry = clients.get(ws);
          if (!entry) return; /* user disconnected */
          if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);

          console.log(`Scheduling TikTok reconnect for ${username} in ${reconnectDelay / 1000}s`);
          entry.reconnectTimer = setTimeout(() => {
            if (!clients.has(ws)) return;
            console.log(`Reconnecting TikTok for ${username}…`);
            try { entry.connection.disconnect(); } catch {}
            reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_DELAY);
            createAndConnect();
          }, reconnectDelay);
        }

        createAndConnect();

      }).catch((err) => {
        broadcast(ws, 'error', { message: 'Failed to load TikTok connector: ' + err.message });
      });
    }

    if (msg.type === 'disconnect') {
      const entry = clients.get(ws);
      if (entry) {
        if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
        try { entry.connection.disconnect(); } catch {}
        clients.delete(ws);
        broadcast(ws, 'disconnected', { message: 'Disconnected by user' });
      }
    }
  });

  ws.on('close', () => {
    const entry = clients.get(ws);
    if (entry) {
      if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
      try { entry.connection.disconnect(); } catch {}
      clients.delete(ws);
    }
    console.log('Client disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
