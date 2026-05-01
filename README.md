# voice-to-us

A drop-in voice-note widget. Visitors press a mic on any embedded page, speak, stop, and the recording lands in your **Telegram** with the page context, an AI transcript, and the contact channel they picked.

```
┌───────────────────┐   audio   ┌──────────────────────────┐  caption + voice  ┌──────────┐
│  Browser widget   │ ────────▶ │ Express backend          │ ────────────────▶ │ Telegram │
│  MediaRecorder    │           │  · ffmpeg → OGG/Opus     │                   │   bot    │
│  Shadow DOM UI    │           │  · Whisper transcription │                   └──────────┘
└───────────────────┘           │  · Google ID-token verify│
                                └──────────────────────────┘
```

- **`widget/`** — single self-contained JS file (`voice-to-us.js`) that drops a mic button into any website. Shadow-DOM-isolated, ~50 KB. See [Embedding](#embedding-the-widget).
- **`backend/`** — Express server: receives the audio, transcodes to OGG/Opus (bundled ffmpeg), transcribes via OpenAI Whisper, fans the voice + caption out to one or more Telegram recipients.
- **`frontend/`** — small Next.js app used as a local development page (the prod-grade demo lives at `/widget-demo` on the backend).
- **`prototype/`** — design references the widget UI was built against.

## What's in the box (current: v0.1.9)

- ✅ **One-click voice recording** with Shadow-DOM isolation (no host CSS leaks)
- ✅ **Multi-channel reply form** after recording: Telegram, WhatsApp, Google sign-in, manual email — visitor picks any one
- ✅ **Verified Google sign-in** (audience-checked server-side via Google `tokeninfo`)
- ✅ **Whisper AI transcript** automatically attached to the Telegram caption
- ✅ **Floating bottom bar** with quick links to Telegram / WhatsApp / WeChat QR + a "Connect" menu (X / LinkedIn / GitHub / GMIC.ai / mailto)
- ✅ **Multi-recipient fan-out** to N Telegram bots in parallel
- ✅ **Localhost guard** so dev tests don't page real recipients (with a `/widget-demo` exemption)
- ✅ **Receipt link + admin reply page** (opt-in, generates `gmic.ai/voice2us/r/<slug>` URLs the visitor can revisit)
- ✅ **Page context attached** — title + URL + timestamp travel with every voice note
- ✅ **Fully themeable** — colors, sizes, labels, channel handles, all configurable per embed via `data-*` attributes

## Prerequisites

- Node.js 18.17+
- A Telegram account for each recipient bot
- Optional: OpenAI API key (for Whisper transcription)
- Optional: Google Cloud OAuth Client ID (for Google sign-in)

## 1 · Create a Telegram bot and get its token

1. Chat with [**@BotFather**](https://t.me/BotFather) on Telegram.
2. Send `/newbot`. Pick a name and a unique username ending in `bot`.
3. BotFather replies with a token like `123456789:ABCdefGhIJKlmNoPQRsTuvWxyZ` — that's your `TELEGRAM_BOT_TOKEN`.

## 2 · Get the recipient's chat_id

A bot can only DM users **after they've messaged it first**:

1. Have the recipient open the bot chat (search by its username) and press **Start**.
2. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Copy `message.chat.id` — that's `TELEGRAM_CHAT_ID`.

### 2.1 — Multiple recipients

Every voice upload fans out in parallel to N recipients. Each additional recipient needs their own bot (Telegram limit, not ours):

```
TELEGRAM_BOT_TOKEN=8123...
TELEGRAM_CHAT_ID=111111111

# second recipient (e.g. the boss)
TELEGRAM_BOT_TOKEN_2=9456...
TELEGRAM_CHAT_ID_2=222222222
```

Supports `_2` through `_20`. Incomplete pairs are silently skipped.

## 3 · (Optional) Whisper transcription

To get an AI transcript on every Telegram message:

1. Get an API key at <https://platform.openai.com/api-keys>.
2. Add to `backend/.env`:
   ```
   OPENAI_API_KEY=sk-proj-...
   # OPENAI_TRANSCRIBE_MODEL=whisper-1   (default; or use gpt-4o-transcribe)
   ```
3. The backend transcribes in parallel with the ffmpeg transcode, so latency stays under 5 s for 30-second voice notes.

If `OPENAI_API_KEY` is unset, voice notes still ship — just without a transcript.

## 4 · (Optional) Google sign-in

To enable the **Continue with Google** button in the contact form:

1. Open <https://console.cloud.google.com/apis/credentials>.
2. **Create Credentials → OAuth Client ID → Web application**.
3. Under **Authorized JavaScript origins**, add every origin where the widget is embedded:
   - `http://localhost:4000` (local dev)
   - `https://gmic.ai` (production)
   - `https://your-partner-site.com` (each third-party embed needs its own entry)
4. Copy the Client ID (`xxx.apps.googleusercontent.com`) and add to `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   ```
5. The widget reads its own client ID from `data-google-client-id` (or its baked-in default). Both the widget client ID and the server `GOOGLE_CLIENT_ID` must match for token verification to succeed.

If `GOOGLE_CLIENT_ID` is unset, the **Continue with Google** button still appears in the form, but submissions through it return 400.

## 5 · Configure environment variables

```bash
cp backend/.env.example backend/.env
# fill in TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
# (optional) OPENAI_API_KEY, GOOGLE_CLIENT_ID
# (optional) PUBLIC_BASE_URL=https://gmic.ai/voice2us  -- required in prod behind a reverse proxy

cp frontend/.env.local.example frontend/.env.local
# default NEXT_PUBLIC_BACKEND_URL=http://localhost:4000 is fine for local dev
```

**Local-test guard.** By default, uploads from a `localhost` page skip Telegram + Whisper entirely (so dev tests don't page real recipients or burn API credits). The `/widget-demo` path is exempt. To exercise the full flow against your real bot from localhost, set `ALLOW_LOCAL_SENDS=true` in `backend/.env`.

## 6 · Install and run

```bash
# backend
cd backend
npm install
npm run dev
# → voice-to-us backend listening on http://localhost:4000
```

```bash
# frontend (optional — only if you want the Next.js dev page)
cd frontend
npm install
npm run dev
# → http://localhost:3100
```

Open <http://localhost:4000/widget-demo> for the full demo page (recommended), or <http://localhost:3100> for the bare Next.js page. Tap the mic, speak, tap again. The recipient sees a voice bubble in Telegram within a couple of seconds.

## Message format

Each upload is delivered as a Telegram voice bubble with an HTML caption containing the page context, the chosen reply channel, the contact info (verified when via Google), and the AI transcript:

```
[▶ Voice 0:07]
Contact Us — GMIC AI
https://gmic.ai/contact
Reply via: telegram
Name: Charles
Email: charles@gmic.ai
Reply here: https://gmic.ai/voice2us/r/abc234xyz/admin/01ab...   (only when receipt link is enabled)
Transcript:
"Hi — I'm calling about your demo offer..."
2026-05-01 14:32 UTC
```

Captions are HTML-escaped server-side and truncated to fit Telegram's 1024-char limit (transcript shrinks first).

## Embedding the widget

The widget is published via jsDelivr from this repo's tagged releases. Any site can embed it with a single `<script>` tag — no static hosting needed for the JS. Shadow DOM keeps host styles isolated.

**Pin to a specific tag** (latest is `v0.1.9`):

```
https://cdn.jsdelivr.net/gh/gmic-ai-inc/voice-to-us@v0.1.9/widget/voice-to-us.js
```

> Always pin a tag (`@v0.1.9`), never `@main` / `@latest` — jsDelivr caches branches up to 7 days. To roll forward, bump the tag (see [Releasing](#releasing-a-new-widget-version)).

Your backend must be on a public HTTPS URL to receive the audio. The same backend serves `widget/voice-to-us.js` at `GET /widget.js` — useful in dev (no need to commit-and-tag for every change).

Set `FRONTEND_ORIGIN` in `backend/.env` to either `*` (any origin) or a comma-separated allowlist of embed origins:

```
FRONTEND_ORIGIN=https://site-a.com,https://site-b.com
```

### Option A — auto-mount on a placeholder

```html
<script
  src="https://cdn.jsdelivr.net/gh/gmic-ai-inc/voice-to-us@v0.1.9/widget/voice-to-us.js"
  data-backend="https://gmic.ai/voice2us"
  data-mount="#voice-btn"
  async
></script>
<div id="voice-btn"></div>
```

### Option B — floating bubble + bar (v0.1.9+)

```html
<script
  src="https://cdn.jsdelivr.net/gh/gmic-ai-inc/voice-to-us@v0.1.9/widget/voice-to-us.js"
  data-backend="https://gmic.ai/voice2us"
  data-floating="true"
  data-placement="bottom-center"
  async
></script>
```

In floating mode the widget renders as a horizontal bar:

```
[Telegram] [WhatsApp] [WeChat]  🎤  [⋯]
```

Quick-link icons (Telegram, WhatsApp, WeChat) bypass the recording flow — they open the chat directly. The mic still works as before. The `⋯` button opens a "Connect" dropdown with X / LinkedIn / GitHub / GMIC.ai / mailto.

To opt out and keep the simple floating mic, add `data-show-bar="false"`.

`data-placement` accepts `bottom-right` (default), `bottom-center`, `bottom-left`.

### Option C — programmatic (for SPAs)

```html
<script src="https://cdn.jsdelivr.net/gh/gmic-ai-inc/voice-to-us@v0.1.9/widget/voice-to-us.js"></script>
<div id="voice-btn"></div>
<script>
  const instance = VoiceToUs.mount('#voice-btn', {
    backend: 'https://gmic.ai/voice2us',
  });
  // later: instance.destroy();
</script>
```

A live demo runs at **<https://gmic.ai/voice2us/widget-demo>** (or `http://localhost:4000/widget-demo` when running the backend locally).

## Customizing

Every visible string and look knob is configurable. Below: data attributes on the script tag (auto-mount) — the same keys nest under `theme` / `labels` for programmatic use.

### Theme

| option | data attribute | default |
| --- | --- | --- |
| `theme.color` | `data-color` | `#111111` |
| `theme.textColor` | `data-text-color` | `#ffffff` |
| `theme.labelColor` | `data-label-color` | `#111111` |
| `theme.ringColor` | `data-ring-color` | `#e5e5e5` |
| `theme.ringPulseColor` | `data-ring-pulse-color` | `#bdbdbd` |
| `theme.errorColor` | `data-error-color` | `#c0392b` |
| `theme.size` | `data-size` | `72` (px) |

### Status labels

| option | data attribute | default |
| --- | --- | --- |
| `labels.idle` | `data-label-idle` | `Tap to record` |
| `labels.recording` | `data-label-recording` | `Recording… tap to stop` |
| `labels.uploading` | `data-label-uploading` | `Sending…` |
| `labels.sent` | `data-label-sent` | `Got it! We'll get back to you soon.` |
| `labels.error` | `data-label-error` | `Error` |

### Contact form (after recording stops)

| option | data attribute | default |
| --- | --- | --- |
| `collectContact` | `data-collect-contact="false"` (to disable) | `true` |
| `telegramHandle` | `data-telegram-handle` | `gmicai` (becomes `t.me/gmicai`) |
| `whatsappNumber` | `data-whatsapp-number` | `+16699000008` |
| `googleClientId` | `data-google-client-id` | `934733898751-...` (override per embed) |
| `labels.formTitle` | `data-label-form-title` | `Want a reply? (pick any one)` |
| `labels.chanTelegram` | `data-label-chan-telegram` | `Reply via Telegram` |
| `labels.chanTelegramSub` | `data-label-chan-telegram-sub` | `One click — like chatting with a real person` |
| `labels.chanWhatsApp` | `data-label-chan-whatsapp` | `Reply via WhatsApp` |
| `labels.chanGoogle` | `data-label-chan-google` | `Continue with Google` |
| `labels.emailExpand` | `data-label-email-expand` | `Use email instead` |
| `labels.emailPlaceholder` | `data-label-email-placeholder` | `you@example.com` |
| `labels.formSubmit` | `data-label-form-submit` | `Send` |
| `labels.formCancel` | `data-label-form-cancel` | `Cancel` |
| `labels.formClose` | `data-label-form-close` | `Close` |
| `labels.formInvalidEmail` | `data-label-form-invalid-email` | `That email looks off` |
| `labels.formFooter` | `data-label-form-footer` | `Only used to reply to this message · No account · No ads` |
| `labels.whatsappPrefilledText` | `data-label-whatsapp-prefilled` | `Hi! I just left a voice note...` |

### Floating bar (v0.1.9, floating mode only)

| option | data attribute | default |
| --- | --- | --- |
| `showBar` | `data-show-bar="false"` (to disable) | `true` in floating mode |
| `linkTwitter` | `data-link-twitter` | `https://x.com/GMICAIINC` |
| `linkLinkedin` | `data-link-linkedin` | `https://www.linkedin.com/company/gmicaiinc/` |
| `linkGithub` | `data-link-github` | `https://github.com/xtrigg` |
| `linkGmicai` | `data-link-gmicai` | `https://gmic.ai/` |
| `linkEmail` | `data-link-email` | `t@xtrigg.com` |
| `wechatQrUrl` | `data-wechat-qr-url` | `<backend>/wechat-qr.png` |
| `labels.barWechatLabel` | (n/a — set via `labels` option) | `Scan to add me on WeChat · 扫一扫加微信` |
| `labels.barConnectSection` | (n/a — set via `labels` option) | `Connect` |

To drop a single bar link without losing the rest, set the attr to `false` or `off`:

```html
<script
  src="..."
  data-link-github="off"
  data-link-email="custom@yourcompany.com"
></script>
```

### Attention animation

| option | data attribute | default |
| --- | --- | --- |
| `attention` | `data-attention="false"` (to disable) | `true` |
| `attentionDuration` | `data-attention-duration` (ms) | `6000` |

### Receipt link (opt-in, currently in beta)

`data-receipt-enabled="true"` activates a "save this link to come back later" feature — the visitor gets a unique URL they can bookmark to revisit if/when the team replies via the admin page. See `backend/src/server.js` for the `/r/:slug` and `/r/:slug/admin/:token` routes.

### Example — branded embed

```html
<script
  src="https://cdn.jsdelivr.net/gh/gmic-ai-inc/voice-to-us@v0.1.9/widget/voice-to-us.js"
  data-backend="https://gmic.ai/voice2us"
  data-mount="#voice-btn"
  data-color="#1976d2"
  data-ring-pulse-color="#64b5f6"
  data-size="80"
  data-label-idle="Ask a question"
  data-label-form-title="How should we get back to you?"
></script>
<div id="voice-btn"></div>
```

## Releasing a new widget version

```bash
# bump widget/voice-to-us.js version string + demo.html refs
git add widget/voice-to-us.js widget/demo.html
git commit -m "feat(v0.1.x): <what changed>"
git push origin main

git tag v0.1.X
git push origin v0.1.X
```

Within seconds the new file is live at `https://cdn.jsdelivr.net/gh/gmic-ai-inc/voice-to-us@v0.1.X/widget/voice-to-us.js`. Existing embeds on older tags keep serving their pinned bytes immutably — update embedders' `<script src=...>` to roll forward.

For the production backend, also: `git pull && pm2 restart voice-to-us --update-env` on the server.

## Notes

- Browsers record `audio/webm;codecs=opus` (Chrome / Edge / Firefox) or `audio/mp4` (Safari). The backend transcodes to 48 kHz mono OGG/Opus because Telegram's `sendVoice` requires that exact format.
- ffmpeg is provided by the `@ffmpeg-installer/ffmpeg` npm package — no system install needed.
- Max upload size is 25 MB (Telegram bot upload limit).
- Whisper has the same 25 MB cap and supports the formats the browser produces (no extra transcode needed for transcription).
- The receipt-link admin page uses path-based proxy-prefix-safe redirects (relative `?ok=1`) so it works regardless of where nginx mounts the backend. Set `PUBLIC_BASE_URL` in `.env` so the absolute admin URL printed in Telegram matches the public host.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Telegram API error: Forbidden: bot can't initiate conversation with a user` | Recipient hasn't messaged the bot yet. Have them press **Start**. |
| `Telegram API error: Bad Request: chat not found` | `TELEGRAM_CHAT_ID` is wrong, or the token belongs to a different bot. |
| Google sign-in shows `Error 400: origin_mismatch` | The embed origin isn't in the OAuth Client's **Authorized JavaScript origins**. Add it (no path, just scheme + host + port). |
| Google sign-in popup doesn't open / "unavailable" inline error | Browser suppressed One Tap; the widget falls back to popup automatically. If that also fails, check origins. |
| Whisper returns 429 | OpenAI rate limit. Either retry (audio still ships without transcript) or upgrade the API plan. |
| Caption is delivered as plain text (no bold, no clickable link) | The URL is `localhost:...` — Telegram won't auto-link non-public hosts. Test from a public URL. |
| `ffmpeg exited 1` with `Unknown encoder 'libopus'` | Bundled ffmpeg lacks libopus on this platform. Install system ffmpeg (`brew install ffmpeg`) and adjust `telegram.js`. |
| CORS error in browser console | `FRONTEND_ORIGIN` in `backend/.env` doesn't match the embed origin. |
| Bar / channel buttons don't appear in floating mode | Hard-refresh — browsers aggressively cache `widget.js`. |

## Version history (widget)

- **v0.1.9** — Floating bottom bar with quick-link icons (Telegram / WhatsApp / WeChat QR) and Connect dropdown (X / LinkedIn / GitHub / GMIC.ai / mailto)
- **v0.1.8** — Default Telegram handle changed to `@gmicai`
- **v0.1.7** — Friendlier success copy ("Got it! We'll get back to you soon.")
- **v0.1.6** — Receipt-link feature toggled off by default until further polish
- **v0.1.5** — Receipt-link page + admin reply page; Google sign-in
- **v0.1.4** — Form refactor: Telegram / WhatsApp deep-link buttons, dropped phone, multi-channel picker
- **v0.1.3** — Contact form (email/phone), Whisper transcription, demo-call CTA
- **v0.1.2** — Page title + URL + timestamp in caption
- **v0.1.1** — Floating placement (bottom-right / bottom-center / bottom-left)
- **v0.1.0** — Initial release: mic button, audio upload, Telegram fan-out
