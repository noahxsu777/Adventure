# TikTok Live Chat TTS

A modern web app with a dark TikTok-style UI that connects to TikTok Live streams via [TikTok-Live-Connector](https://github.com/zerodytrash/TikTok-Live-Connector) and reads chat events aloud using Text-to-Speech.

![UI Screenshot](https://github.com/user-attachments/assets/ed242600-9726-405d-9616-4efcd981469b)

## Features

- **Chat TTS** – Converts incoming chat messages to speech automatically via the Web Speech API. Toggle username reading, select voices, and adjust playback speed.
- **Live Chat Panel** – Real-time display of chat messages, gifts, likes, and follows with per-event toggle buttons.
- **Audio Controls** – Play / Pause / Stop TTS, volume slider, speed slider, voice selector, and a queue visualization.
- **Filter System** – Optional keyword filter to read only matching messages.
- **Background Playback** – TTS continues when the tab is hidden or minimized.
- **Dark Theme** – iOS-inspired glassmorphism dark UI, responsive for mobile and desktop.
- **Radio / `!play` command** – Any viewer can type `!play <song name or YouTube URL>` in TikTok chat to queue a YouTube audio stream. A full-screen iOS "Now Playing" card appears with album art, animated equalizer, and title.

## `!play` Radio Command

Type in TikTok Live chat:

| Command | What happens |
|---------|-------------|
| `!play lo-fi hip hop` | Searches YouTube and plays the top result |
| `!play https://youtu.be/dQw4w9WgXcQ` | Plays a specific YouTube video (audio only view) |
| `!play https://www.youtube.com/watch?v=dQw4w9WgXcQ` | Same, full URL format |

The server uses the Invidious open-source YouTube API (no credentials required) to resolve searches. If all Invidious instances are unreachable, it falls back to YouTube's embed search. Audio streams directly from YouTube via the embedded player — no files are downloaded.

## Getting Started

```bash
npm install
npm start
```

Open `http://localhost:3000`, enter a TikTok username that is currently live, and click **Connect**.

## Architecture

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, ws (WebSocket) |
| TikTok API | tiktok-live-connector |
| YouTube search | Invidious public API (no key) |
| Frontend | Vanilla HTML/CSS/JS, Web Speech API |

The Node.js server connects to TikTok's live stream and forwards events over WebSocket to the browser. The frontend renders events in real time and queues them for TTS playback.