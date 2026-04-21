# voice-to-us

A voice-note prototype: press a mic button in the browser, speak, stop, and the recording is delivered as a Telegram **voice message** to a preconfigured Telegram user.

```
┌─────────────────┐     audio/webm     ┌──────────────────┐   OGG/Opus   ┌──────────┐
│  Next.js (web)  │ ─────────────────▶ │ Express + ffmpeg │ ───────────▶ │ Telegram │
│  MediaRecorder  │                    │   sendVoice      │              │   Bot    │
└─────────────────┘                    └──────────────────┘              └──────────┘
```

- **frontend/** — Next.js 14 app, single page with the mic button from `prototype/voice-button.png`.
- **backend/** — Express server that accepts the upload, transcodes to OGG/Opus with a bundled ffmpeg, and calls the Telegram Bot API `sendVoice`.
- **widget/** — self-contained JS file (`voice-to-us.js`) that drops the mic button into any website in ~3 lines. See [Embedding the widget](#embedding-the-widget).

## Prerequisites

- Node.js 18.17+
- A Telegram account for the bot and for the target recipient

## 1 · Create a Telegram bot and get its token

1. Open Telegram and chat with [**@BotFather**](https://t.me/BotFather).
2. Send `/newbot`. Choose a name and a unique username ending in `bot`.
3. BotFather replies with an HTTP API token that looks like `123456789:ABCdefGhIJKlmNoPQRsTuvWxyZ`. This is your `TELEGRAM_BOT_TOKEN`.

## 2 · Get the recipient's chat_id

A Telegram bot can only DM a user **after that user has messaged the bot first**. So:

1. Ask the recipient to open the bot's chat (search by its username) and press **Start** (or send any message).
2. In your browser, visit:

   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```

3. Find the most recent `message` object and copy `message.chat.id` — that is the recipient's `TELEGRAM_CHAT_ID` (a number, sometimes negative for groups).

> If `getUpdates` is empty, have the user send the bot another message and refresh.

## 3 · Configure environment variables

```bash
cp backend/.env.example backend/.env
# edit backend/.env and fill TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID

cp frontend/.env.local.example frontend/.env.local
# default NEXT_PUBLIC_BACKEND_URL=http://localhost:4000 is fine for local dev
```

## 4 · Install and run

In two terminals:

```bash
# backend
cd backend
npm install
npm run dev
# → voice-to-us backend listening on http://localhost:4000
```

```bash
# frontend
cd frontend
npm install
npm run dev
# → http://localhost:3100
```

Open http://localhost:3100, tap the mic, speak, tap again to stop. The recipient should receive a voice bubble in Telegram within a second or two.

## Embedding the widget

The backend serves `widget/voice-to-us.js` at `GET /widget.js`. Any website — Wordpress, plain HTML, Webflow, Next/Vue/whatever — can drop the mic button in with a few lines. The widget uses Shadow DOM so it inherits no host styles and leaks none.

Before going cross-origin, set `FRONTEND_ORIGIN` in `backend/.env` to either `*` (allow any origin) or a comma-separated list of the sites that will embed it:

```
FRONTEND_ORIGIN=https://site-a.com,https://site-b.com
```

**Option A — auto-mount on a placeholder** (zero JS to write):

```html
<script
  src="https://your-backend.example.com/widget.js"
  data-backend="https://your-backend.example.com"
  data-mount="#voice-btn"
  async
></script>
<div id="voice-btn"></div>
```

**Option B — floating bubble in the corner** (no mount point needed):

```html
<script
  src="https://your-backend.example.com/widget.js"
  data-backend="https://your-backend.example.com"
  data-floating="true"
  async
></script>
```

**Option C — programmatic**, for SPAs that render asynchronously:

```html
<script src="https://your-backend.example.com/widget.js"></script>
<div id="voice-btn"></div>
<script>
  const instance = VoiceToUs.mount('#voice-btn', {
    backend: 'https://your-backend.example.com',
  });
  // later: instance.destroy();
</script>
```

A live demo is served at `http://localhost:4000/widget-demo` while the backend is running.

### Customizing the look

All colors, the button size, and the label text are configurable.

| option | data attribute | default | notes |
| --- | --- | --- | --- |
| `theme.color` | `data-color` | `#111111` | button background |
| `theme.textColor` | `data-text-color` | `#ffffff` | mic/stop icon color |
| `theme.labelColor` | `data-label-color` | `#111111` | label text + border |
| `theme.ringColor` | `data-ring-color` | `#e5e5e5` | static outer ring |
| `theme.ringPulseColor` | `data-ring-pulse-color` | `#bdbdbd` | animated ring while recording |
| `theme.errorColor` | `data-error-color` | `#c0392b` | label color on error |
| `theme.size` | `data-size` | `72` | button diameter in px (icon scales) |
| `labels.idle` | `data-label-idle` | `Tap to record` | |
| `labels.recording` | `data-label-recording` | `Recording… tap to stop` | |
| `labels.uploading` | `data-label-uploading` | `Sending…` | |
| `labels.sent` | `data-label-sent` | `Sent!` | |
| `labels.error` | `data-label-error` | `Error` | shown when no specific error message |

Via data attributes (auto-mount):

```html
<script
  src="https://your-backend/widget.js"
  data-backend="https://your-backend"
  data-mount="#voice-btn"
  data-color="#e91e63"
  data-ring-pulse-color="#f48fb1"
  data-size="88"
  data-label-idle="Send us a voice note"
></script>
<div id="voice-btn"></div>
```

Via JS:

```html
<script src="https://your-backend/widget.js"></script>
<div id="voice-btn"></div>
<script>
  VoiceToUs.mount('#voice-btn', {
    backend: 'https://your-backend',
    theme: {
      color: '#1976d2',
      ringPulseColor: '#64b5f6',
      size: 72,
    },
    labels: { idle: 'Ask a question', sent: 'Got it!' },
  });
</script>
```

## Notes

- The browser records `audio/webm;codecs=opus` (Chrome/Edge/Firefox) or `audio/mp4` (Safari). The backend always transcodes to 48 kHz mono OGG/Opus because Telegram's `sendVoice` requires that exact format to render as a voice bubble.
- ffmpeg is provided by the `@ffmpeg-installer/ffmpeg` npm package — no system install needed.
- Max upload size is 25 MB (Telegram's bot upload limit).
- The recipient is hardcoded via `TELEGRAM_CHAT_ID`. To support multiple recipients, extend the `/api/upload` route to accept a recipient id and look it up server-side.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Telegram API error: Forbidden: bot can't initiate conversation with a user` | The recipient hasn't messaged the bot yet. Ask them to press **Start** in the bot chat. |
| `Telegram API error: Bad Request: chat not found` | `TELEGRAM_CHAT_ID` is wrong or the bot token belongs to a different bot. |
| `ffmpeg exited 1` with `Unknown encoder 'libopus'` | The bundled ffmpeg build on your platform lacks libopus. Install a system ffmpeg (`brew install ffmpeg`) and change `telegram.js` to use it. |
| CORS error in the browser console | `FRONTEND_ORIGIN` in `backend/.env` doesn't match the page origin. |
