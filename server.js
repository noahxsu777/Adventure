const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));

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
      import('tiktok-live-connector').then(({ TikTokLiveConnection, WebcastEvent }) => {
        const connection = new TikTokLiveConnection(username, {
          processInitialData: false   // ignore chat history
        });

        clients.set(ws, connection);

        connection.connect()
          .then((state) => {
            console.log(`Connected to ${username} (roomId ${state.roomId})`);
            broadcast(ws, 'connected', { username, roomId: state.roomId });
          })
          .catch((err) => {
            console.error('Connection failed:', err.message);
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
            giftName: data.giftName || `Gift #${data.giftId}`,
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
