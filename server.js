const express = require('express');
const http = require('http');
const { Readable } = require('stream');
const { WebSocketServer, WebSocket } = require('ws');
const sharp = require('sharp');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));
app.use(express.json());

app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));

const RADIO_STREAM_ALLOWLIST = new Set([
  'https://icecast.radiofrance.fr/fip-midfi.mp3',
  'https://stream.radioparadise.com/mp3-128',
  'https://ice2.somafm.com/groovesalad-128-mp3',
  'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service'
]);

app.get('/api/radio-proxy', async (req, res) => {
  try {
    const safeUrl = String(req.query.url || '');
    if (!RADIO_STREAM_ALLOWLIST.has(safeUrl)) {
      return res.status(400).json({ error: 'Radio stream is not allowed' });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const upstream = await fetch(safeUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Lively Radio Player/1.0',
        'Accept': 'audio/*,*/*;q=0.8',
        'Icy-MetaData': '1'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!upstream.ok || !upstream.body) {
      throw new Error(`Radio stream ${upstream.status}`);
    }
    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    res.status(200);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'no-store');
    res.set('X-Accel-Buffering', 'no');
    const stream = Readable.fromWeb(upstream.body);
    req.on('close', () => stream.destroy());
    stream.on('error', () => {
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });
    stream.pipe(res);
  } catch (err) {
    res.status(400).json({ error: 'Radio proxy error: ' + err.message });
  }
});

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

/* tik.tools Gift Catalog — enriches the static GIFT_CATALOG with API data */
app.get('/api/gifts/catalog', async (_req, res) => {
  try {
    const resp = await fetch('https://api.tik.tools/v1/gifts', {
      headers: {
        'Authorization': `Bearer ${TIKTOOLS_API_KEY}`,
        'User-Agent': 'Mozilla/5.0'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!resp.ok) throw new Error(`tik.tools gifts ${resp.status}`);
    const raw = await resp.json();
    const arr = Array.isArray(raw) ? raw : (raw.gifts || raw.data || raw.items || []);
    const gifts = arr.map(g => ({
      id: g.id ?? g.giftId ?? g.gift_id,
      name: g.name || g.giftName || g.gift_name || '',
      image: g.image || g.imageUrl || g.image_url || g.pictureUrl || g.picture_url || '',
      diamonds: g.diamonds ?? g.diamondCount ?? g.diamond_count ?? 0
    })).filter(g => g.id != null && g.name);
    res.json(gifts);
  } catch (err) {
    console.log('tik.tools gift catalog unavailable:', err.message);
    res.json([]);
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
const TIKTOOLS_API_KEY = process.env.TIKTOOLS_API_KEY || 'tk_235e481d7e949fa580b3f0b3bf8040223481c16e398d2abb';

/** Track active TikTok connections per WebSocket client */
const clients = new Map();

/* ============================================================
   Premium connection via tik.tools — persistent WebSocket
   ============================================================ */
function connectPremium(ws, username) {
  let reconnectDelay = 5000;
  const MAX_DELAY = 60000;

  function openTikTools() {
    const tikUrl = `wss://api.tik.tools?uniqueId=${encodeURIComponent(username)}&apiKey=${TIKTOOLS_API_KEY}`;
    const tikWs = new WebSocket(tikUrl);
    clients.set(ws, { tikWs, username, reconnectTimer: null, mode: 'premium' });

    tikWs.on('open', () => {
      console.log(`[Premium] Connected to tik.tools for ${username}`);
      reconnectDelay = 5000;
      broadcast(ws, 'connected', { username, mode: 'premium' });
    });

    tikWs.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      const event = msg.event || msg.type;
      const data = msg.data || {};
      const user = data.user || {};

      switch (event) {
        case 'chat':
          broadcast(ws, 'chat', {
            user: user.uniqueId || 'unknown',
            nickname: user.nickname || '',
            comment: data.comment || '',
            profilePictureUrl: user.profilePictureUrl || '',
            isModerator: user.isModerator || false,
            isSubscriber: user.isSubscriber || false
          });
          break;
        case 'gift':
          broadcast(ws, 'gift', {
            user: user.uniqueId || 'unknown',
            nickname: user.nickname || '',
            giftId: data.giftId || 0,
            giftName: data.giftName || `Gift #${data.giftId || 0}`,
            giftPictureUrl: data.giftPictureUrl || '',
            diamondCount: data.diamondCount || 0,
            repeatCount: data.repeatCount || 1,
            repeatEnd: data.repeatEnd ?? true,
            profilePictureUrl: user.profilePictureUrl || ''
          });
          break;
        case 'like':
          broadcast(ws, 'like', {
            user: user.uniqueId || 'unknown',
            nickname: user.nickname || '',
            likeCount: data.likeCount || data.totalLikes || 1,
            profilePictureUrl: user.profilePictureUrl || ''
          });
          break;
        case 'follow':
          broadcast(ws, 'follow', {
            user: user.uniqueId || 'unknown',
            nickname: user.nickname || '',
            profilePictureUrl: user.profilePictureUrl || ''
          });
          break;
        case 'member':
          broadcast(ws, 'member', {
            user: user.uniqueId || 'unknown',
            nickname: user.nickname || '',
            profilePictureUrl: user.profilePictureUrl || ''
          });
          break;
        case 'roomUserSeq':
          broadcast(ws, 'roomUserSeq', { viewerCount: data.viewerCount || 0 });
          break;
        case 'error':
          broadcast(ws, 'error', { message: data.message || 'tik.tools error' });
          break;
      }
    });

    tikWs.on('close', () => {
      const entry = clients.get(ws);
      if (!entry) return;
      console.log(`[Premium] tik.tools disconnected for ${username}, reconnecting in ${reconnectDelay / 1000}s…`);
      broadcast(ws, 'tiktok_reconnecting', { message: 'Reconectando conexión premium…' });
      entry.reconnectTimer = setTimeout(() => {
        if (!clients.has(ws)) return;
        reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_DELAY);
        openTikTools();
      }, reconnectDelay);
    });

    tikWs.on('error', (err) => {
      console.error(`[Premium] tik.tools error for ${username}:`, err?.message || err);
    });
  }

  openTikTools();
}

/**
 * Recursively scan an object for image URLs (stickers/emotes/badges).
 * Returns [{ id, url, label }] — stops at `maxDepth` to avoid huge traversals.
 */
function extractImageUrls(obj, maxDepth, _depth = 0) {
  const results = [];
  if (!obj || _depth > maxDepth) return results;
  if (typeof obj !== 'object') return results;
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      if (/tiktokcdn\.com.*\.(png|jpg|jpeg|webp|image)/i.test(val)) {
        results.push({ id: obj.id || obj.emoteId || obj.emojiId || key, url: val, label: obj.name || obj.title || obj.emojiName || '' });
      }
    } else if (Array.isArray(val)) {
      val.forEach(item => results.push(...extractImageUrls(item, maxDepth, _depth + 1)));
    } else if (typeof val === 'object' && val !== null) {
      results.push(...extractImageUrls(val, maxDepth, _depth + 1));
    }
  }
  return results;
}

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
      const mode = msg.mode === 'premium' ? 'premium' : 'normal';
      if (!username) {
        broadcast(ws, 'error', { message: 'Username is required' });
        return;
      }

      /* Disconnect previous connection if any */
      const prev = clients.get(ws);
      if (prev) {
        if (prev.reconnectTimer) clearTimeout(prev.reconnectTimer);
        if (prev.mode === 'premium') {
          try { prev.tikWs.close(); } catch {}
        } else {
          try { prev.connection.disconnect(); } catch {}
        }
        clients.delete(ws);
      }

      if (mode === 'premium') {
        connectPremium(ws, username);
        return;
      }

      import('tiktok-live-connector').then(({ TikTokLiveConnection, WebcastEvent, UserOfflineError }) => {

        function createAndConnect(extendedGiftInfo = true) {
          const connection = new TikTokLiveConnection(username, {
            processInitialData: false,
            enableExtendedGiftInfo: extendedGiftInfo
          });

          /* Store connection + metadata for this client */
          clients.set(ws, { connection, username, reconnectTimer: null });

          connection.connect()
            .then(async (state) => {
              console.log(`Connected to ${username} (roomId ${state.roomId}, extendedGifts=${extendedGiftInfo})`);
              reconnectDelay = 5000; /* reset backoff on success */
              broadcast(ws, 'connected', { username, roomId: state.roomId, extendedGiftInfo });

              /* ── Try to fetch fan club stickers / emotes on connect ── */
              try {
                const stickers = [];

                /* 1. Scan roomInfo for any emote/sticker/badge image URLs */
                const roomData = state.roomInfo;
                if (roomData) {
                  const found = extractImageUrls(roomData, 4);
                  found.forEach(({ id, url, label }, idx) => {
                    if (url && (url.includes('tiktokcdn') || url.includes('webcast'))) {
                      stickers.push({ emoteId: id || `room_${idx}`, emoteImageUrl: url, label: label || 'Fan Sticker' });
                    }
                  });
                }

                /* 2. Try to fetch emote list from TikTok webcast API using the library's HTTP client */
                const axios = connection.webClient?.axiosInstance;
                if (axios && state.roomId) {
                  try {
                    const emojiResp = await axios.get('https://webcast.tiktok.com/webcast/emoji/list/', {
                      params: { aid: '1988', room_id: state.roomId },
                      timeout: 5000
                    });
                    const emojiData = emojiResp?.data?.data || emojiResp?.data;
                    if (emojiData) {
                      const panels = emojiData.emojiGroups || emojiData.emoji_groups || emojiData.panels || [];
                      (Array.isArray(panels) ? panels : []).forEach(panel => {
                        const emojis = panel.emojis || panel.emoji_list || panel.emojiList || panel.stickers || [];
                        (Array.isArray(emojis) ? emojis : []).forEach(e => {
                          const eid = e.emojiId || e.emoji_id || e.id || e.emoteId || '';
                          const eimg = e.emojiUrl || e.emoji_url || e.url || e.image?.url?.[0] || e.image?.imageUri || '';
                          const ename = e.emojiName || e.emoji_name || e.name || e.title || '';
                          if (eid && eimg) stickers.push({ emoteId: String(eid), emoteImageUrl: eimg, label: ename || 'Sticker' });
                        });
                      });
                    }
                  } catch (emoErr) {
                    console.log('Emoji list fetch failed (non-fatal):', emoErr?.message || emoErr);
                  }
                }

                if (stickers.length > 0) {
                  console.log(`Found ${stickers.length} stickers/emotes for ${username}`);
                  broadcast(ws, 'fan_stickers', { stickers });
                }
              } catch (stickerErr) {
                console.log('Sticker extraction failed (non-fatal):', stickerErr?.message || stickerErr);
              }
            })
            .catch((err) => {
              const rawMsg = err?.message || (typeof err === 'string' ? err : '');
              console.error('Connection failed:', rawMsg || err);

              /* If enableExtendedGiftInfo caused a 403, retry without it */
              if (extendedGiftInfo && rawMsg.includes('403')) {
                console.log('Extended gift info failed (403), retrying without it...');
                createAndConnect(false);
                return;
              }

              /* Translate known errors to Spanish */
              let errorMsg = rawMsg || 'Error de conexión desconocido';
              if (UserOfflineError && err instanceof UserOfflineError) {
                errorMsg = 'El usuario no está en LIVE :(';
              } else if (/user.*not.*found/i.test(rawMsg)) {
                errorMsg = 'Usuario no encontrado';
              } else if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(rawMsg)) {
                errorMsg = 'Error de red, reintentando…';
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

          /* Dedup: prevent broadcasting duplicate gift events within 2s window */
          const recentGifts = {};
          connection.on(WebcastEvent.GIFT, (data) => {
            const dedupKey = `${data.user?.uniqueId}_${data.giftId}_${data.repeatCount}`;
            const now = Date.now();
            if (recentGifts[dedupKey] && now - recentGifts[dedupKey] < 2000) return;
            recentGifts[dedupKey] = now;
            /* Cleanup old entries */
            for (const k in recentGifts) {
              if (now - recentGifts[k] > 5000) delete recentGifts[k];
            }

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

          /* Capture super-fan and barrage stickers as triggers (guard: events may not exist) */
          let sfCounter = 0;
          if ('SUPER_FAN' in WebcastEvent) {
            connection.on(WebcastEvent.SUPER_FAN, (data) => {
              const user = data.user?.uniqueId || 'unknown';
              const imgs = extractImageUrls(data, 3);
              imgs.forEach(({ id, url, label }) => {
                if (url) broadcast(ws, 'emote', { user, emoteId: id || `sf_${++sfCounter}`, emoteImageUrl: url, label: label || 'SuperFan' });
              });
            });
          }

          let barCounter = 0;
          if ('BARRAGE' in WebcastEvent) {
            connection.on(WebcastEvent.BARRAGE, (data) => {
              const user = data.user?.uniqueId || 'unknown';
              const imgs = extractImageUrls(data, 3);
              imgs.forEach(({ id, url, label }) => {
                if (url) broadcast(ws, 'emote', { user, emoteId: id || `bar_${++barCounter}`, emoteImageUrl: url, label: label || 'Barrage' });
              });
            });
          }

          /* Server-side auto-reconnect: keep connection alive */
          connection.on('disconnected', () => {
            console.log(`TikTok disconnected for ${username}, will auto-reconnect server-side`);
            broadcast(ws, 'tiktok_reconnecting', { message: 'Stream interrupted, reconnecting…' });
            scheduleReconnect();
          });

          connection.on('error', (err) => {
            console.error(`TikTok error for ${username}:`, err?.message || err);
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

    if (msg.type === 'keepalive') {
      broadcast(ws, 'pong', { timestamp: Date.now() });
    }

    if (msg.type === 'disconnect') {
      const entry = clients.get(ws);
      if (entry) {
        if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
        if (entry.mode === 'premium') {
          try { entry.tikWs.close(); } catch {}
        } else {
          try { entry.connection.disconnect(); } catch {}
        }
        clients.delete(ws);
        broadcast(ws, 'disconnected', { message: 'Disconnected by user' });
      }
    }
  });

  ws.on('close', () => {
    const entry = clients.get(ws);
    if (entry) {
      if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
      if (entry.mode === 'premium') {
        try { entry.tikWs.close(); } catch {}
      } else {
        try { entry.connection.disconnect(); } catch {}
      }
      clients.delete(ws);
    }
    console.log('Client disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
