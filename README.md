# TikTok Live Chat TTS

A modern web app with a dark TikTok-style UI that connects to TikTok Live streams via [TikTok-Live-Connector](https://github.com/zerodytrash/TikTok-Live-Connector) and reads chat events aloud using Text-to-Speech.

## Features

- **Chat TTS** – Converts incoming chat messages to speech automatically via the Web Speech API. Toggle username reading, select voices, and adjust playback speed.
- **Live Chat Panel** – Real-time display of chat messages, gifts, likes, and follows with per-event toggle buttons.
- **Audio Controls** – Play / Pause / Stop TTS, volume slider, speed slider, voice selector, and a queue visualization.
- **Filter System** – Optional keyword filter to read only matching messages.
- **Background Playback** – TTS continues when the tab is hidden or minimized.
- **Dark Theme** – TikTok-inspired dark UI, responsive for mobile and desktop.

## Getting Started

```bash
npm install
npm start
```

Open `http://localhost:3000`, enter a TikTok username that is currently live, and click **Connect**.

## Deploying to Fly.io

```bash
fly launch
fly deploy
```

The app is configured to listen on `0.0.0.0` and uses `PORT` from the environment (set automatically by Fly.io). The `fly.toml` and `Dockerfile` are included and ready to use.

## Architecture

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, ws (WebSocket) |
| TikTok API | tiktok-live-connector |
| Frontend | Vanilla HTML/CSS/JS, Web Speech API |

The Node.js server connects to TikTok's live stream and forwards events over WebSocket to the browser. The frontend renders events in real time and queues them for TTS playback.