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
        prev.disconnect();
        clients.delete(ws);
      }

      /* Dynamic import because tiktok-live-connector is ESM-only in v2 */
      broadcast(ws, 'status', { step: 'loading', message: '📦 Loading TikTok connector…' });

      import('tiktok-live-connector').then(({ TikTokLiveConnection, WebcastEvent }) => {
        broadcast(ws, 'status', { step: 'initializing', message: '⚙️ Initializing connection…' });

        const connection = new TikTokLiveConnection(username, {
          processInitialData: false,       // ignore chat history
          enableExtendedGiftInfo: true     // full gift metadata (name, image, diamonds)
        });

        clients.set(ws, connection);

        broadcast(ws, 'status', { step: 'connecting', message: `🔍 Searching for @${username}'s live stream…` });

        connection.connect()
          .then((state) => {
            console.log(`Connected to ${username} (roomId ${state.roomId})`);
            broadcast(ws, 'status', { step: 'success', message: `✅ Connected! Room ID: ${state.roomId}` });
            broadcast(ws, 'connected', { username, roomId: state.roomId });
          })
          .catch((err) => {
            console.error('Connection failed:', err.message);
            broadcast(ws, 'status', { step: 'error', message: `❌ ${err.message}` });
            broadcast(ws, 'error', { message: err.message });
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

        connection.on('disconnected', () => {
          broadcast(ws, 'disconnected', { message: 'TikTok stream disconnected' });
          clients.delete(ws);
        });

        connection.on('error', (err) => {
          broadcast(ws, 'error', { message: err.message || 'Unknown error' });
        });
      }).catch((err) => {
        broadcast(ws, 'error', { message: 'Failed to load TikTok connector: ' + err.message });
      });
    }

    if (msg.type === 'disconnect') {
      const conn = clients.get(ws);
      if (conn) {
        conn.disconnect();
        clients.delete(ws);
        broadcast(ws, 'disconnected', { message: 'Disconnected by user' });
      }
    }
  });

  ws.on('close', () => {
    const conn = clients.get(ws);
    if (conn) {
      conn.disconnect();
      clients.delete(ws);
    }
    console.log('Client disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
