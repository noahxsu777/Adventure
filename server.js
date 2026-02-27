const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const sharp = require('sharp');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));
app.use(express.json());

app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));

/* Logo with transparent background (cached in memory) */
const LOGO_URL = 'https://i.imgur.com/MMF1AZ6.jpeg';
let cachedLogoPng = null;

app.get('/img/logo.png', async (_req, res) => {
  try {
    if (cachedLogoPng) {
      return res.set('Cache-Control', 'public, max-age=86400').type('image/png').send(cachedLogoPng);
    }
    const resp = await fetch(LOGO_URL);
    if (!resp.ok) throw new Error(`Logo fetch failed: ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = data;
    const threshold = 230; // near-white threshold
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > threshold && pixels[i + 1] > threshold && pixels[i + 2] > threshold) {
        pixels[i + 3] = 0; // set alpha to 0 for white/near-white pixels
      }
    }
    cachedLogoPng = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    res.set('Cache-Control', 'public, max-age=86400').type('image/png').send(cachedLogoPng);
  } catch (err) {
    console.error('Logo processing error:', err.message);
    res.redirect(LOGO_URL);
  }
});

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

/* Microsoft Edge TTS proxy — high-quality neural voices, free, no registration */
const EDGE_VOICES = new Set([
  'es-CO-SalomeNeural','es-CO-GonzaloNeural',
  'es-MX-DaliaNeural','es-MX-JorgeNeural',
  'es-ES-ElviraNeural','es-ES-AlvaroNeural',
  'es-AR-ElenaNeural','es-AR-TomasNeural',
  'es-CL-CatalinaNeural','es-CL-LorenzoNeural',
  'es-VE-PaolaNeural','es-VE-SebastianNeural',
  'es-PE-CamilaNeural','es-PE-AlexNeural',
  'en-US-JennyNeural','en-US-GuyNeural','en-US-AriaNeural','en-US-DavisNeural',
  'en-GB-SoniaNeural','en-GB-RyanNeural',
  'pt-BR-FranciscaNeural','pt-BR-AntonioNeural',
  'fr-FR-DeniseNeural','fr-FR-HenriNeural',
  'de-DE-KatjaNeural','de-DE-ConradNeural',
  'it-IT-ElsaNeural','it-IT-DiegoNeural',
  'ja-JP-NanamiNeural','ja-JP-KeitaNeural',
  'ko-KR-SunHiNeural','ko-KR-InJoonNeural',
  'zh-CN-XiaoxiaoNeural','zh-CN-YunxiNeural'
]);

app.get('/api/edge-tts', async (req, res) => {
  const { voice, text } = req.query;
  if (!text) return res.status(400).send('Missing text');
  const safeVoice = EDGE_VOICES.has(voice) ? voice : 'es-CO-SalomeNeural';

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(safeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text.slice(0, 300));

    const chunks = [];
    await new Promise((resolve, reject) => {
      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });
    const buffer = Buffer.concat(chunks);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(buffer);
  } catch (err) {
    const msg = typeof err === 'string' ? err : (err?.message || 'Unknown error');
    res.status(502).send('Edge TTS proxy error: ' + msg);
  }
});

/* ============================================================
   MyInstants Sound Effects — search via direct scraping + API fallback
   ============================================================ */

const MI_API = 'https://myinstants-api.vercel.app';
const MI_SITE = 'https://www.myinstants.com';

/** Map Vercel API response items to { title, mp3 } */
function mapMiResults(json) {
  /* The Vercel API returns { status, data: [...] }, extract the array */
  const arr = Array.isArray(json) ? json : (json && Array.isArray(json.data) ? json.data : []);
  return arr.map(s => ({ title: s.title || s.name || '', mp3: s.mp3 || '' })).filter(s => s.mp3);
}

/**
 * Scrape MyInstants.com HTML search page for sounds.
 * Returns [{ title, mp3 }]
 */
async function scrapeMyInstants(path) {
  const url = `${MI_SITE}${path}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  if (!resp.ok) throw new Error(`MyInstants site ${resp.status}`);
  const html = await resp.text();

  /* Parse sounds from HTML — MyInstants uses <div class="instant"> with onclick and title */
  const sounds = [];
  const TITLE_SEARCH_WINDOW = 500;
  /* Pattern: onclick/onmousedown with play('/media/sounds/file.mp3', ...) — capture the sound path */
  const playPattern = /(?:onclick|onmousedown)\s*=\s*"play\s*\(\s*'(\/media\/sounds\/[^']+)'/g;
  let match;
  while ((match = playPattern.exec(html)) !== null) {
    let mp3 = match[1];
    if (mp3.startsWith('/')) mp3 = MI_SITE + mp3;

    /* Find title near this match — look for the closest <a class="instant-link"> before/after */
    const before = html.substring(Math.max(0, match.index - TITLE_SEARCH_WINDOW), match.index + match[0].length + TITLE_SEARCH_WINDOW);
    const titleMatch = before.match(/class="instant-link"[^>]*title="([^"]+)"/);
    const titleMatch2 = before.match(/class="instant-link"[^>]*>([^<]+)</);
    const title = titleMatch ? titleMatch[1] : (titleMatch2 ? titleMatch2[1].trim() : mp3.split('/').pop().replace('.mp3', ''));

    sounds.push({ title, mp3 });
  }
  return sounds;
}

/**
 * Search sounds: try Vercel API first, fallback to direct scraping.
 */
async function searchMyInstants(query) {
  /* Try Vercel API first */
  try {
    const url = `${MI_API}/search?q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (resp.ok) {
      const results = mapMiResults(await resp.json());
      if (results.length > 0) return results;
    }
  } catch (e) {
    console.log('Vercel API failed, falling back to direct scraping:', e.message);
  }

  /* Fallback: scrape myinstants.com directly — use + for spaces like the site expects */
  return scrapeMyInstants(`/en/search/?name=${encodeURIComponent(query).replace(/%20/g, '+')}`);
}

app.get('/api/sounds/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json([]);
  try {
    const results = await searchMyInstants(q);
    res.json(results);
  } catch (err) {
    console.error('MyInstants search error:', err.message);
    res.status(502).json({ error: 'Sound search failed: ' + err.message });
  }
});

/* Built-in popular sounds catalog — always available, no API needed */
const POPULAR_SOUNDS = [
  { title: 'Airhorn', mp3: 'https://www.myinstants.com/media/sounds/air-horn-club-sample_1.mp3' },
  { title: 'Bruh', mp3: 'https://www.myinstants.com/media/sounds/movie_1.mp3' },
  { title: 'Sad Violin', mp3: 'https://www.myinstants.com/media/sounds/sad-violin_1.mp3' },
  { title: 'Wow', mp3: 'https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3' },
  { title: 'Fail', mp3: 'https://www.myinstants.com/media/sounds/the-price-is-right-losing-horn.mp3' },
  { title: 'Drum Roll', mp3: 'https://www.myinstants.com/media/sounds/drum-roll-sound-effect.mp3' },
  { title: 'Rimshot', mp3: 'https://www.myinstants.com/media/sounds/rimshot.mp3' },
  { title: 'Ta Da!', mp3: 'https://www.myinstants.com/media/sounds/tada.mp3' },
  { title: 'Applause', mp3: 'https://www.myinstants.com/media/sounds/small-crowd-applause.mp3' },
  { title: 'Crickets', mp3: 'https://www.myinstants.com/media/sounds/crickets.mp3' },
  { title: 'Suspense', mp3: 'https://www.myinstants.com/media/sounds/dun-dun-dun.mp3' },
  { title: 'Wilhelm Scream', mp3: 'https://www.myinstants.com/media/sounds/wilhelmscream.mp3' },
  { title: 'Cash Register', mp3: 'https://www.myinstants.com/media/sounds/cash-register-sound.mp3' },
  { title: 'Wrong Answer', mp3: 'https://www.myinstants.com/media/sounds/wrong-answer-sound-effect.mp3' },
  { title: 'Victory', mp3: 'https://www.myinstants.com/media/sounds/ff-victory.mp3' },
  { title: 'Game Over', mp3: 'https://www.myinstants.com/media/sounds/pacman_death.mp3' },
  { title: 'Mario Coin', mp3: 'https://www.myinstants.com/media/sounds/coin.mp3' },
  { title: 'Mario 1-Up', mp3: 'https://www.myinstants.com/media/sounds/1-up.mp3' },
  { title: 'Vine Boom', mp3: 'https://www.myinstants.com/media/sounds/vine-boom.mp3' },
  { title: 'Oof', mp3: 'https://www.myinstants.com/media/sounds/roblox-death-sound_1.mp3' },
  { title: 'Bonk', mp3: 'https://www.myinstants.com/media/sounds/bonk.mp3' },
  { title: 'Nope', mp3: 'https://www.myinstants.com/media/sounds/nope.mp3' },
  { title: 'Hello There', mp3: 'https://www.myinstants.com/media/sounds/hello-there.mp3' },
  { title: 'Wasted (GTA)', mp3: 'https://www.myinstants.com/media/sounds/gta-v-wasted.mp3' },
  { title: 'Emotional Damage', mp3: 'https://www.myinstants.com/media/sounds/emotional-damage-meme.mp3' },
  { title: 'FBI Open Up', mp3: 'https://www.myinstants.com/media/sounds/fbi-open-up_1.mp3' },
  { title: 'To Be Continued', mp3: 'https://www.myinstants.com/media/sounds/to-be-continued.mp3' },
  { title: 'Windows Error', mp3: 'https://www.myinstants.com/media/sounds/erro.mp3' },
  { title: 'Windows XP Startup', mp3: 'https://www.myinstants.com/media/sounds/windowsxpstartup.mp3' },
  { title: 'Metal Gear Alert', mp3: 'https://www.myinstants.com/media/sounds/metal-gear-solid-alert-sound.mp3' },
  { title: 'Alarm', mp3: 'https://www.myinstants.com/media/sounds/alarm.mp3' },
  { title: 'Ship Horn', mp3: 'https://www.myinstants.com/media/sounds/ship-horn.mp3' },
  { title: 'Whistle', mp3: 'https://www.myinstants.com/media/sounds/referee-whistle-blow.mp3' },
  { title: 'Doorbell', mp3: 'https://www.myinstants.com/media/sounds/doorbell_8.mp3' },
  { title: 'Magic Spell', mp3: 'https://www.myinstants.com/media/sounds/magic-spell.mp3' },
  { title: 'Level Up', mp3: 'https://www.myinstants.com/media/sounds/level-up-sound.mp3' },
  { title: 'Explosion', mp3: 'https://www.myinstants.com/media/sounds/explosion_x.mp3' },
  { title: 'Laugh Track', mp3: 'https://www.myinstants.com/media/sounds/sitcom-laughing.mp3' },
  { title: 'Record Scratch', mp3: 'https://www.myinstants.com/media/sounds/record-scratch.mp3' },
  { title: 'Boing', mp3: 'https://www.myinstants.com/media/sounds/boing_1.mp3' },
];

/* Popular / trending sounds — built-in catalog + API enrichment */
app.get('/api/sounds/popular', async (_req, res) => {
  /* Always return built-in catalog immediately */
  let results = [...POPULAR_SOUNDS];

  /* Try to also get trending from API (non-blocking, adds more variety) */
  try {
    const resp = await fetch(`${MI_API}/best`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (resp.ok) {
      const apiResults = mapMiResults(await resp.json());
      /* Add API results that aren't duplicates */
      const existingTitles = new Set(results.map(s => s.title.toLowerCase()));
      for (const s of apiResults) {
        if (!existingTitles.has(s.title.toLowerCase())) {
          results.push(s);
        }
      }
    }
  } catch {
    /* API failed, that's fine — we have the built-in catalog */
  }

  res.json(results);
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
            enableExtendedGiftInfo: false
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
              profilePictureUrl: data.user?.profilePictureUrl || '',
              isModerator: data.userIdentity?.isModeratorOfAnchor || false,
              isSubscriber: data.userIdentity?.isSubscriberOfAnchor || false
            });
          });

          connection.on(WebcastEvent.GIFT, (data) => {
            broadcast(ws, 'gift', {
              user: data.user?.uniqueId || 'unknown',
              nickname: data.user?.nickname || '',
              giftId: data.giftId,
              giftName: data.giftName || `Gift #${data.giftId}`,
              giftPictureUrl: data.giftPictureUrl || '',
              diamondCount: data.diamondCount || 0,
              repeatCount: data.repeatCount || 1,
              repeatEnd: data.repeatEnd ?? true,
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

          connection.on(WebcastEvent.EMOTE, (data) => {
            const user = data.user?.uniqueId || 'unknown';
            const nickname = data.user?.nickname || '';
            const profilePictureUrl = data.user?.profilePictureUrl || '';

            /* Send individual emotes from emoteList for trigger collection */
            const emoteList = Array.isArray(data.emoteList) ? data.emoteList : [];
            if (emoteList.length > 0) {
              emoteList.forEach(e => {
                const eid = e.emoteId || '';
                const eimg = e.image?.imageUri || e.image?.urlList?.[0] || '';
                if (eid) broadcast(ws, 'emote', { user, nickname, emoteId: eid, emoteImageUrl: eimg, profilePictureUrl });
              });
            } else {
              /* Fallback: single emote from legacy fields */
              broadcast(ws, 'emote', {
                user, nickname,
                emoteId: data.emoteId || data.emote?.emoteId || '',
                emoteImageUrl: data.emote?.image?.imageUri || data.emote?.image?.urlList?.[0] || '',
                profilePictureUrl
              });
            }
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
