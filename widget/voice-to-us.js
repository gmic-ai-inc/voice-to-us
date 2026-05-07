/*!
 * voice-to-us widget
 * Embeddable mic button that records audio and POSTs it to a voice-to-us backend,
 * which forwards it as a Telegram voice message to a preconfigured recipient.
 *
 * Usage (auto-mount via script tag):
 *   <script src="https://your-backend/widget.js"
 *           data-backend="https://your-backend"
 *           data-mount="#voice-btn"></script>
 *   <div id="voice-btn"></div>
 *
 * Usage (floating bubble):
 *   <script src="https://your-backend/widget.js"
 *           data-backend="https://your-backend"
 *           data-floating="true"></script>
 *
 * Usage (programmatic):
 *   <script src="https://your-backend/widget.js"></script>
 *   <script>VoiceToUs.mount('#voice-btn', { backend: 'https://your-backend' })</script>
 */
(function () {
  'use strict';

  var DEFAULT_LABELS = {
    idle: 'Tap to record',
    recording: 'Recording… tap to stop',
    uploading: 'Sending…',
    sent: 'Got it! We\'ll get back to you soon.',
    error: 'Error',
    formTitle: 'Want a reply? (pick any one)',
    chanTelegram: 'Reply via Telegram',
    chanTelegramSub: 'One click — like chatting with a real person',
    chanWhatsApp: 'Reply via WhatsApp',
    chanGoogle: 'Continue with Google',
    formDivider: 'or',
    googleSignInError: 'Google Sign-In unavailable. Try email instead.',
    receiptLabel: 'Save this link to check back anytime',
    receiptCopy: 'Copy',
    receiptCopied: 'Copied!',
    successTitle: 'Sent!',
    successSubtitle: 'Bookmark this link — when our team replies, it appears there.',
    barWechatLabel: 'Scan to add me on WeChat · 扫一扫加微信',
    barConnectSection: 'Connect',
    emailExpand: 'Use email instead',
    emailPlaceholder: 'you@example.com',
    formSubmit: 'Send',
    formCancel: 'Cancel',
    formClose: 'Close',
    formInvalidEmail: 'That email looks off',
    formFooter: 'Only used to reply to this message · No account · No ads',
    whatsappPrefilledText: 'Hi! I just left a voice note on your site — looking forward to your reply.',
  };

  var DEFAULT_TELEGRAM_HANDLE = 'gmicai';
  var DEFAULT_WHATSAPP_NUMBER = '+16699000008';
  var DEFAULT_GOOGLE_CLIENT_ID = '934733898751-ov2n1oidtm6filhb1fomatnr5pb65p16.apps.googleusercontent.com';
  /* v0.1.9 floating-bar links — overridable per embed via data-link-* attrs.
     GitHub is hidden by default (empty); embeds that want it visible can
     set data-link-github="https://github.com/your-org". */
  var DEFAULT_TWITTER_URL = 'https://x.com/GMICAIINC';
  var DEFAULT_LINKEDIN_URL = 'https://www.linkedin.com/company/gmicaiinc/';
  var DEFAULT_GITHUB_URL = '';
  var DEFAULT_GMICAI_URL = 'https://gmic.ai/';
  var DEFAULT_TEAM_EMAIL = 'Trigg@gmic.ai';
  /* QR served from the same backend that serves widget.js — see server.js. */
  var DEFAULT_WECHAT_QR_PATH = '/wechat-qr.png';

  var TELEGRAM_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3L19.8 4.54c.73-.33 1.43.18 1.15 1.3l-3.26 15.36c-.19.91-.74 1.13-1.5.71L12.6 18.5l-1.99 1.93c-.23.23-.42.42-.83.42z"/>' +
    '</svg>';

  var WHATSAPP_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/>' +
    '</svg>';

  var GOOGLE_SVG =
    '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>' +
    '<path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>' +
    '<path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>' +
    '<path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>' +
    '</svg>';

  /* Bar icons — verbatim from ustrigg.com/about (filled, currentColor). */
  var BAR_TELEGRAM_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"></path>' +
    '</svg>';
  var BAR_WHATSAPP_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.465 3.488"></path>' +
    '</svg>';
  var BAR_WECHAT_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M8.667 7.504c.456 0 .831.378.831.838a.838.838 0 0 1-.83.838.836.836 0 0 1-.832-.838.834.834 0 0 1 .831-.838zm5.32 0a.834.834 0 0 1 .831.838.836.836 0 0 1-.83.838.838.838 0 0 1-.832-.838.834.834 0 0 1 .831-.838zM9.5 3C5.358 3 2 5.715 2 9.064c0 1.86 1.04 3.523 2.665 4.65l-.665 2 2.319-1.16c.829.247 1.722.39 2.665.395.215 0 .43-.012.642-.034a4.81 4.81 0 0 1-.297-1.66c0-3.142 2.967-5.7 6.642-5.7.21 0 .417.013.622.038C15.024 4.682 12.483 3 9.5 3zm6.5 6.5c-3.314 0-6 2.13-6 4.75 0 1.485.866 2.815 2.234 3.69l-.567 1.708 2-1c.717.213 1.49.351 2.333.353.21 0 .417-.013.622-.038-.214-.732-.336-1.51-.336-2.314 0-3.142 3.13-5.689 7-5.689l.166.001C23.456 8.27 19.97 6.5 16 6.5z"></path>' +
    '</svg>';
  var BAR_DOTS_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="6" cy="12" r="1.6"></circle>' +
    '<circle cx="12" cy="12" r="1.6"></circle>' +
    '<circle cx="18" cy="12" r="1.6"></circle>' +
    '</svg>';
  var X_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"></path>' +
    '</svg>';
  var LINKEDIN_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path>' +
    '</svg>';
  var GITHUB_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.51 11.51 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.38-3.88-1.38-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.45.11-3.02 0 0 .97-.31 3.18 1.18a10.98 10.98 0 0 1 5.78 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.57.23 2.73.11 3.02.73.8 1.18 1.83 1.18 3.09 0 4.41-2.7 5.39-5.27 5.67.41.35.78 1.04.78 2.1v3.12c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"></path>' +
    '</svg>';
  var BUILDING_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="3" width="16" height="18" rx="1.5"></rect>' +
    '<path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"></path>' +
    '</svg>';
  var MAIL_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="2.5" y="5" width="19" height="14" rx="2"></rect>' +
    '<path d="m3 7 9 6 9-6"></path>' +
    '</svg>';

  var GOOGLE_GSI_SRC = 'https://accounts.google.com/gsi/client';
  var googleSdkPromise = null;

  var PIN_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 2v6"></path><path d="m9 6 3-3 3 3"></path><path d="M5 12h14"></path><path d="M5 12v9h14v-9"></path>' +
    '</svg>';

  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M5 12l4 4L19 7"></path>' +
    '</svg>';

  var SLUG_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'; // no l/i/o/0/1
  function randomSlug(len) {
    len = len || 12;
    var out = '';
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint8Array(len);
      window.crypto.getRandomValues(buf);
      for (var i = 0; i < len; i++) {
        out += SLUG_ALPHABET[buf[i] % SLUG_ALPHABET.length];
      }
    } else {
      for (var j = 0; j < len; j++) {
        out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
      }
    }
    return out;
  }

  function loadGoogleSdk() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      return Promise.resolve();
    }
    if (googleSdkPromise) return googleSdkPromise;
    googleSdkPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-v2u-google-sdk]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('Google SDK failed to load')); });
        return;
      }
      var s = document.createElement('script');
      s.src = GOOGLE_GSI_SRC;
      s.async = true;
      s.defer = true;
      s.setAttribute('data-v2u-google-sdk', '1');
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Google SDK failed to load')); };
      document.head.appendChild(s);
    });
    return googleSdkPromise;
  }

  var PLACEMENT_CSS = {
    'bottom-right':  'right:24px;bottom:24px;',
    'bottom-left':   'left:24px;bottom:24px;',
    'bottom-center': 'left:50%;bottom:24px;transform:translateX(-50%);',
  };

  function normalizePlacement(p) {
    p = (p || 'bottom-right').toString().toLowerCase().trim();
    return PLACEMENT_CSS[p] ? p : 'bottom-right';
  }

  var DEFAULT_THEME = {
    color: '#111111',           /* button background */
    textColor: '#ffffff',       /* mic / stop icon colour */
    labelColor: '#111111',      /* label text + border */
    ringColor: '#e5e5e5',       /* static outer ring */
    ringPulseColor: '#bdbdbd',  /* animated pulse ring while recording */
    errorColor: '#c0392b',      /* label colour in error state */
    size: 72,                   /* button diameter in px */
  };

  var STYLES = [
    ':host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--v2u-label-color)}',
    '.wrap{display:inline-flex;flex-direction:column;align-items:center;gap:1.5rem}',
    '.label{border:1px solid var(--v2u-label-color);color:var(--v2u-label-color);padding:.4rem 1.25rem;font-size:1rem;min-width:160px;text-align:center;border-radius:2px;user-select:none}',
    '.label.err{border-color:var(--v2u-error-color);color:var(--v2u-error-color)}',
    '.btn{position:relative;width:var(--v2u-size);height:var(--v2u-size);display:flex;align-items:center;justify-content:center;border-radius:9999px;background:var(--v2u-color);color:var(--v2u-text-color);border:none;cursor:pointer;transition:transform .1s;padding:0}',
    '.btn:active:not(:disabled){transform:scale(.95)}',
    '.btn:disabled{opacity:.6;cursor:not-allowed}',
    '.ring{position:absolute;inset:calc(var(--v2u-size) * -0.22);border-radius:9999px;border:1px solid var(--v2u-ring-color);pointer-events:none}',
    '.ring.pulse{border-color:var(--v2u-ring-pulse-color);animation:v2u-pulse 1.4s ease-out infinite}',
    '@keyframes v2u-pulse{0%{transform:scale(.85);opacity:1}100%{transform:scale(1.45);opacity:0}}',
    /* attention-grabbing radar wave on first view — stopped after a few cycles */
    '.ring.wave{border-color:var(--v2u-ring-pulse-color);opacity:0;animation:v2u-wave 1.8s ease-out infinite;will-change:transform,opacity}',
    '.ring.wave.w2{animation-delay:.6s}',
    '.ring.wave.w3{animation-delay:1.2s}',
    '@keyframes v2u-wave{0%{transform:scale(.85);opacity:.6}80%{opacity:0}100%{transform:scale(1.7);opacity:0}}',
    '@media (prefers-reduced-motion: reduce){.ring.wave{animation:none;display:none}}',
    '.icon{display:flex;align-items:center;justify-content:center;width:calc(var(--v2u-size) * 0.4);height:calc(var(--v2u-size) * 0.4);line-height:0}',
    '.icon svg{width:100%;height:100%;display:block}',
    /* floating mode: tighter layout, no idle outer ring, smaller defaults */
    '.wrap.floating{gap:.4rem;flex-direction:column-reverse}',
    '.wrap.floating.place-right{align-items:flex-end}',
    '.wrap.floating.place-left{align-items:flex-start}',
    '.wrap.floating.place-center{align-items:center}',
    '.wrap.floating .btn{box-shadow:0 4px 14px rgba(0,0,0,.18)}',
    '.wrap.floating .ring:not(.pulse):not(.wave){display:none}',
    '.wrap.floating .ring.pulse,.wrap.floating .ring.wave{inset:calc(var(--v2u-size) * -0.14)}',
    '.wrap.floating .label{background:#fff;color:#222;border:none;box-shadow:0 2px 8px rgba(0,0,0,.08);font-size:.78rem;min-width:0;padding:.28rem .65rem;border-radius:999px}',
    /* contact form (shown after recording stops) */
    '.form{display:none;flex-direction:column;gap:.7rem;width:300px;max-width:92vw;padding:1.1rem 1.1rem .9rem;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.08);box-sizing:border-box;position:relative}',
    '.wrap.show-form .form{display:flex}',
    '.wrap.show-form .label,.wrap.show-form .btn{display:none}',
    '.form__close{position:absolute;top:.45rem;right:.5rem;background:none;border:none;font-size:1.15rem;line-height:1;color:#9ca3af;cursor:pointer;padding:.15rem .4rem;border-radius:4px}',
    '.form__close:hover{background:#f3f4f6;color:#374151}',
    '.form__title{font-size:.92rem;font-weight:600;color:#111;margin:0 1.5rem 0 0;line-height:1.4}',
    /* channel buttons (Telegram, WhatsApp) */
    '.form__channel{display:flex;align-items:center;justify-content:center;gap:.55rem;width:100%;padding:.7rem 1rem;font:inherit;font-size:.95rem;font-weight:500;color:#fff;border:none;border-radius:9999px;cursor:pointer;text-decoration:none;transition:filter .12s,transform .1s,opacity .12s;box-sizing:border-box}',
    '.form__channel:hover{filter:brightness(.94);text-decoration:none;color:#fff}',
    '.form__channel:active{transform:scale(.98)}',
    '.form__channel:disabled{opacity:.55;cursor:not-allowed}',
    '.form__channel-icon{width:1.15em;height:1.15em;flex:none;display:inline-block}',
    '.form__channel-icon svg{width:100%;height:100%;display:block}',
    '.form__channel--telegram{background:#229ED9}',
    '.form__channel--whatsapp{background:#25D366}',
    '.form__channel--google{background:#fff;color:#1f1f1f;border:1px solid #dadce0}',
    '.form__channel--google:hover{background:#f8f9fa;color:#1f1f1f;filter:none}',
    '.form__channel-sub{font-size:.74rem;color:#6b7280;margin:-.35rem 0 0;text-align:center}',
    /* divider */
    '.form__divider{display:flex;align-items:center;gap:.6rem;font-size:.72rem;color:#9ca3af;margin:.05rem 0;text-transform:uppercase;letter-spacing:.06em}',
    '.form__divider::before,.form__divider::after{content:"";flex:1;height:1px;background:#e5e7eb}',
    /* manual email (collapsed) */
    '.form__manual{margin:0}',
    '.form__manual summary{cursor:pointer;font-size:.82rem;color:#374151;list-style:none;padding:.3rem 0;display:flex;align-items:center;gap:.4rem;user-select:none}',
    '.form__manual summary::-webkit-details-marker{display:none}',
    '.form__manual summary::before{content:"▸";font-size:.7em;color:#9ca3af;transition:transform .12s}',
    '.form__manual[open] summary::before{transform:rotate(90deg)}',
    '.form__manual summary:hover{color:#111}',
    '.form__manual-body{display:flex;flex-direction:column;gap:.5rem;margin-top:.45rem}',
    '.form__input{appearance:none;font:inherit;font-size:.9rem;padding:.55rem .7rem;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111;outline:none;width:100%;box-sizing:border-box}',
    '.form__input:focus{border-color:var(--v2u-color);box-shadow:0 0 0 3px rgba(0,0,0,.06)}',
    '.form__input.invalid{border-color:var(--v2u-error-color)}',
    '.form__error{font-size:.75rem;color:var(--v2u-error-color);margin:0;min-height:0}',
    '.form__error:not(:empty){min-height:1em;margin-top:-.2rem}',
    '.form__actions{display:flex;gap:.5rem;justify-content:flex-end}',
    '.form__btn{font:inherit;font-size:.85rem;padding:.45rem .9rem;border-radius:6px;border:1px solid transparent;cursor:pointer;background:#fff}',
    '.form__btn--cancel{color:#374151;border-color:#d1d5db}',
    '.form__btn--cancel:hover{background:#f3f4f6}',
    '.form__btn--submit{background:var(--v2u-color);color:var(--v2u-text-color);border-color:var(--v2u-color)}',
    '.form__btn--submit:disabled{opacity:.45;cursor:not-allowed}',
    '.form__btn--submit:not(:disabled):hover{filter:brightness(.92)}',
    '.form__footer{font-size:.7rem;color:#9ca3af;margin:.2rem 0 0;text-align:center;line-height:1.4}',
    /* v0.1.9 floating-mode bar: quick links + ⋯ menu around the mic */
    '.bar{position:relative;display:flex;align-items:center;gap:.55rem;flex-direction:row}',
    '.wrap.show-form .bar,.wrap.show-success .bar{display:none}',
    '.bar__icon{width:42px;height:42px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;background:#fff;color:#374151;border:1px solid #e5e7eb;cursor:pointer;padding:0;box-shadow:0 1px 3px rgba(0,0,0,.04);transition:background .12s,transform .1s,box-shadow .12s}',
    '.bar__icon:hover{background:#f3f4f6;color:#111;text-decoration:none;box-shadow:0 2px 6px rgba(0,0,0,.08)}',
    '.bar__icon:active{transform:scale(.96)}',
    '.bar__icon svg{width:20px;height:20px;display:block}',
    '.bar__icon-x svg{width:18px;height:18px}',
    '.bar__menu{position:absolute;bottom:calc(100% + .5rem);right:-.4rem;min-width:200px;padding:.4rem 0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.1);display:none;z-index:1}',
    '.bar.show-menu .bar__menu{display:block}',
    '.bar__section{padding:.55rem .9rem .25rem;font-size:.65rem;letter-spacing:.1em;color:#9ca3af;text-transform:uppercase;font-weight:500}',
    '.bar__menu-item{display:flex;align-items:center;gap:.65rem;padding:.5rem .9rem;font-size:.85rem;color:#1f2937;text-decoration:none;cursor:pointer}',
    '.bar__menu-item:hover{background:#f3f4f6;text-decoration:none;color:#111}',
    '.bar__menu-item-icon{width:1rem;height:1rem;flex:none;display:inline-flex;align-items:center;justify-content:center;color:#6b7280}',
    '.bar__menu-item-icon svg{width:100%;height:100%}',
    '.bar__wechat-popover{position:absolute;bottom:calc(100% + .5rem);left:50%;transform:translateX(-50%);background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:.85rem;display:none;z-index:1;text-align:center}',
    '.bar.show-wechat .bar__wechat-popover{display:block}',
    '.bar__wechat-popover img{display:block;width:240px;height:240px;object-fit:contain;border-radius:6px;image-rendering:auto;margin:0 auto}',
    '.bar__wechat-popover-label{font-size:.78rem;color:#6b7280;margin:.55rem 0 0}',
    '.bar__wechat-close{position:absolute;top:.3rem;right:.4rem;background:none;border:none;font-size:1.05rem;line-height:1;color:#9ca3af;cursor:pointer;padding:.15rem .35rem;border-radius:4px}',
    '.bar__wechat-close:hover{background:#f3f4f6;color:#374151}',
    /* hide the standalone label in bar mode — bar icons are self-explanatory.
       During recording / sending / sent flash, the label appears as a chip
       above the bar. */
    '.wrap.has-bar{position:relative}',
    '.wrap.has-bar .label{display:none}',
    '.wrap.has-bar.show-status .label{display:inline-block;position:absolute;bottom:calc(100% + .55rem);left:50%;transform:translateX(-50%);white-space:nowrap;background:#fff;color:#222;border:none;box-shadow:0 2px 8px rgba(0,0,0,.08);font-size:.78rem;padding:.28rem .65rem;border-radius:999px;min-width:0}',
    /* post-submit success panel — same shell as the form, lets the visitor
       save the receipt URL even if they didn't copy it before submitting */
    '.success{display:none;flex-direction:column;gap:.65rem;width:300px;max-width:92vw;padding:1.25rem 1.1rem 1rem;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.08);box-sizing:border-box;position:relative;text-align:center}',
    '.wrap.show-success .success{display:flex}',
    '.wrap.show-success .label,.wrap.show-success .btn{display:none}',
    '.success__close{position:absolute;top:.45rem;right:.5rem;background:none;border:none;font-size:1.15rem;line-height:1;color:#9ca3af;cursor:pointer;padding:.15rem .4rem;border-radius:4px}',
    '.success__close:hover{background:#f3f4f6;color:#374151}',
    '.success__check{width:42px;height:42px;border-radius:9999px;background:#ecfdf5;color:#047857;display:inline-flex;align-items:center;justify-content:center;align-self:center;margin:.2rem 0 0;flex:none}',
    '.success__check svg{width:55%;height:55%;display:block}',
    '.success__title{font-size:1rem;font-weight:600;color:#111;margin:.1rem 1.5rem 0}',
    '.success__sub{font-size:.78rem;color:#6b7280;margin:0;line-height:1.4}',
    '.success .form__receipt{text-align:left;margin-top:.2rem}',
    /* receipt-link panel */
    '.form__receipt{display:flex;flex-direction:column;gap:.4rem;padding:.6rem .7rem;border:1px dashed #d1d5db;border-radius:8px;background:#fafafa}',
    '.form__receipt-label{font-size:.74rem;color:#374151;display:flex;align-items:center;gap:.4rem;line-height:1.3}',
    '.form__receipt-label svg{width:.95em;height:.95em;flex:none;color:#6b7280}',
    '.form__receipt-row{display:flex;gap:.4rem;align-items:center}',
    '.form__receipt-url{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.72rem;color:#6b7280;background:#fff;border:1px solid #e5e7eb;border-radius:5px;padding:.3rem .5rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.form__receipt-copy{flex:none;font:inherit;font-size:.72rem;font-weight:500;padding:.3rem .6rem;border:1px solid #d1d5db;background:#fff;border-radius:5px;cursor:pointer;color:#374151}',
    '.form__receipt-copy:hover{background:#f3f4f6}',
    '.form__receipt-copy.copied{background:#ecfdf5;color:#047857;border-color:#a7f3d0}',
  ].join('');

  var MIC_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="3" width="6" height="12" rx="3"></rect>' +
    '<path d="M5 11a7 7 0 0 0 14 0"></path>' +
    '<line x1="12" y1="18" x2="12" y2="22"></line>' +
    '<line x1="8" y1="22" x2="16" y2="22"></line>' +
    '</svg>';

  var STOP_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<rect x="6" y="6" width="12" height="12" rx="2"></rect>' +
    '</svg>';

  function mount(target, options) {
    options = options || {};
    var backend = (options.backend || '').replace(/\/+$/, '');
    if (!backend) throw new Error('VoiceToUs.mount: "backend" option is required');

    var hostEl =
      typeof target === 'string' ? document.querySelector(target) : target;
    if (!hostEl) throw new Error('VoiceToUs.mount: target not found: ' + target);

    var isFloating = !!options.floating;
    var placement = normalizePlacement(options.placement);
    var userTheme = options.theme || {};
    if (isFloating && userTheme.size == null) {
      userTheme = mergeDefaults(userTheme, { size: 56 });
    }
    var theme = mergeDefaults(DEFAULT_THEME, userTheme);
    var labels = mergeDefaults(DEFAULT_LABELS, options.labels || {});

    var root = hostEl;
    if (isFloating) {
      root = document.createElement('div');
      root.style.cssText =
        'position:fixed;z-index:2147483647;margin:0;padding:0;' +
        PLACEMENT_CSS[placement];
      document.body.appendChild(root);
    }

    applyTheme(root, theme);

    var shadow = root.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className =
      'wrap' +
      (isFloating
        ? ' floating place-' + placement.replace('bottom-', '')
        : '');

    var labelEl = document.createElement('div');
    labelEl.className = 'label';
    labelEl.textContent = labels.idle;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.setAttribute('aria-label', 'Start recording');

    var ringStatic = document.createElement('span');
    ringStatic.className = 'ring';
    var ringPulse = document.createElement('span');
    ringPulse.className = 'ring pulse';
    ringPulse.style.display = 'none';

    var iconWrap = document.createElement('span');
    iconWrap.className = 'icon';
    iconWrap.innerHTML = MIC_SVG;

    btn.appendChild(ringStatic);
    btn.appendChild(ringPulse);

    var waveRings = [];
    var waveTimer = null;
    if (options.attention !== false) {
      ['', 'w2', 'w3'].forEach(function (mod) {
        var w = document.createElement('span');
        w.className = 'ring wave' + (mod ? ' ' + mod : '');
        btn.appendChild(w);
        waveRings.push(w);
      });
    }

    btn.appendChild(iconWrap);
    wrap.appendChild(labelEl);

    // v0.1.9 floating-mode bar config — must be in scope before we use
    // showBar in the conditional below.
    var showBar = isFloating && options.showBar !== false;
    var barLinks = {
      twitter: pickLink(options.linkTwitter, DEFAULT_TWITTER_URL),
      linkedin: pickLink(options.linkLinkedin, DEFAULT_LINKEDIN_URL),
      github: pickLink(options.linkGithub, DEFAULT_GITHUB_URL),
      gmicai: pickLink(options.linkGmicai, DEFAULT_GMICAI_URL),
      email: pickLink(options.linkEmail, DEFAULT_TEAM_EMAIL),
    };
    var wechatQrUrl =
      options.wechatQrUrl != null && options.wechatQrUrl !== ''
        ? String(options.wechatQrUrl)
        : backend + DEFAULT_WECHAT_QR_PATH;

    var barEl = null;
    var barMenuEl = null;
    var barWechatPopover = null;
    if (showBar) {
      wrap.classList.add('has-bar');

      barEl = document.createElement('div');
      barEl.className = 'bar';

      // 3 quick-link icons left of the mic
      var quickTg = makeBarIconButton(BAR_TELEGRAM_SVG, 'Open Telegram');
      var quickWa = makeBarIconButton(BAR_WHATSAPP_SVG, 'Open WhatsApp');
      var quickWechat = makeBarIconButton(BAR_WECHAT_SVG, 'Show WeChat QR');

      // ⋯ "more" menu trigger right of the mic
      var moreBtn = makeBarIconButton(BAR_DOTS_SVG, 'More ways to reach us');

      barEl.appendChild(quickTg);
      barEl.appendChild(quickWa);
      barEl.appendChild(quickWechat);
      barEl.appendChild(btn);
      barEl.appendChild(moreBtn);

      // WeChat QR popover (above the bar)
      barWechatPopover = document.createElement('div');
      barWechatPopover.className = 'bar__wechat-popover';

      var wechatCloseBtn = document.createElement('button');
      wechatCloseBtn.type = 'button';
      wechatCloseBtn.className = 'bar__wechat-close';
      wechatCloseBtn.setAttribute('aria-label', labels.formClose);
      wechatCloseBtn.textContent = '×';

      var wechatImg = document.createElement('img');
      wechatImg.alt = 'WeChat QR';
      wechatImg.src = wechatQrUrl;
      var wechatLabel = document.createElement('div');
      wechatLabel.className = 'bar__wechat-popover-label';
      wechatLabel.textContent = labels.barWechatLabel;
      barWechatPopover.appendChild(wechatCloseBtn);
      barWechatPopover.appendChild(wechatImg);
      barWechatPopover.appendChild(wechatLabel);
      barEl.appendChild(barWechatPopover);

      wechatCloseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        barEl.classList.remove('show-wechat');
      });

      // ⋯ menu — Connect section + email
      barMenuEl = document.createElement('div');
      barMenuEl.className = 'bar__menu';
      barMenuEl.setAttribute('role', 'menu');

      var connectHeader = document.createElement('div');
      connectHeader.className = 'bar__section';
      connectHeader.textContent = labels.barConnectSection;
      barMenuEl.appendChild(connectHeader);

      [
        { url: barLinks.twitter, icon: X_SVG, label: 'X / Twitter', cls: 'bar__icon-x' },
        { url: barLinks.linkedin, icon: LINKEDIN_SVG, label: 'LinkedIn' },
        { url: barLinks.github, icon: GITHUB_SVG, label: 'GitHub' },
        { url: barLinks.gmicai, icon: BUILDING_SVG, label: 'GMIC.ai' },
        { url: barLinks.email ? 'mailto:' + barLinks.email : '', icon: MAIL_SVG, label: barLinks.email },
      ].forEach(function (item) {
        if (!item.url || !item.label) return;
        var a = document.createElement('a');
        a.className = 'bar__menu-item';
        a.href = item.url;
        a.setAttribute('role', 'menuitem');
        if (!/^mailto:|^tel:/i.test(item.url)) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
        var ico = document.createElement('span');
        ico.className = 'bar__menu-item-icon' + (item.cls ? ' ' + item.cls : '');
        ico.innerHTML = item.icon;
        var txt = document.createElement('span');
        txt.textContent = item.label;
        a.appendChild(ico);
        a.appendChild(txt);
        barMenuEl.appendChild(a);
      });

      barEl.appendChild(barMenuEl);
      wrap.appendChild(barEl);

      // ── interactions ──
      quickTg.addEventListener('click', function () {
        try { window.open(buildTelegramUrl(), '_blank', 'noopener,noreferrer'); } catch (_) {}
      });
      quickWa.addEventListener('click', function () {
        try { window.open(buildWhatsappUrl(), '_blank', 'noopener,noreferrer'); } catch (_) {}
      });
      quickWechat.addEventListener('click', function (e) {
        e.stopPropagation();
        barEl.classList.remove('show-menu');
        barEl.classList.toggle('show-wechat');
      });
      moreBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        barEl.classList.remove('show-wechat');
        barEl.classList.toggle('show-menu');
      });
      // close menu when a menu item is clicked (link opens in new tab anyway)
      barMenuEl.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.bar__menu-item')) {
          barEl.classList.remove('show-menu');
        }
      });

      // dismiss popovers on shadow-internal clicks outside the bar
      shadow.addEventListener('click', function (e) {
        if (!barEl.contains(e.target)) {
          barEl.classList.remove('show-menu');
          barEl.classList.remove('show-wechat');
        }
      });
    } else {
      wrap.appendChild(btn);
    }

    // Outside-click (host page) closes popovers. Events that originate inside
    // the shadow root are retargeted to `root` from the document's view, so
    // root.contains(e.target) is true for in-widget clicks. Also Esc anywhere.
    var outsideClickHandler = null;
    var escKeyHandler = null;
    if (showBar) {
      outsideClickHandler = function (e) {
        if (!barEl) return;
        if (!root.contains(e.target)) {
          barEl.classList.remove('show-menu');
          barEl.classList.remove('show-wechat');
        }
      };
      escKeyHandler = function (e) {
        if (e.key === 'Escape' && barEl) {
          barEl.classList.remove('show-menu');
          barEl.classList.remove('show-wechat');
        }
      };
      document.addEventListener('click', outsideClickHandler);
      document.addEventListener('keydown', escKeyHandler);
    }

    var collectContact = options.collectContact !== false;

    var telegramHandle = sanitizeHandle(
      options.telegramHandle != null && options.telegramHandle !== ''
        ? options.telegramHandle
        : DEFAULT_TELEGRAM_HANDLE,
    );
    var whatsappNumber = sanitizeNumber(
      options.whatsappNumber != null && options.whatsappNumber !== ''
        ? options.whatsappNumber
        : DEFAULT_WHATSAPP_NUMBER,
    );
    var googleClientId = String(
      options.googleClientId != null && options.googleClientId !== ''
        ? options.googleClientId
        : DEFAULT_GOOGLE_CLIENT_ID,
    ).trim();
    // Receipt link is opt-in (default off) until the flow is polished.
    var receiptEnabled = options.receiptEnabled === true;

    var formEl = null;
    var emailInput = null;
    var emailDetails = null;
    var submitBtn = null;
    var cancelBtn = null;
    var errorEl = null;
    var telegramBtn = null;
    var whatsappBtn = null;
    var googleBtn = null;
    var topErrorEl = null;
    var formCloseBtn = null;
    var receiptEl = null;
    var receiptUrlEl = null;
    var receiptCopyBtn = null;
    var successEl = null;
    var successUrlEl = null;
    var successCopyBtn = null;
    var successCloseBtn = null;
    var currentSlug = '';
    if (collectContact) {
      formEl = document.createElement('form');
      formEl.className = 'form';
      formEl.setAttribute('novalidate', '');

      formCloseBtn = document.createElement('button');
      formCloseBtn.type = 'button';
      formCloseBtn.className = 'form__close';
      formCloseBtn.setAttribute('aria-label', labels.formClose);
      formCloseBtn.textContent = '×';

      var titleEl = document.createElement('div');
      titleEl.className = 'form__title';
      titleEl.textContent = labels.formTitle;

      formEl.appendChild(formCloseBtn);
      formEl.appendChild(titleEl);

      if (telegramHandle) {
        telegramBtn = document.createElement('button');
        telegramBtn.type = 'button';
        telegramBtn.className = 'form__channel form__channel--telegram';
        var tgIcon = document.createElement('span');
        tgIcon.className = 'form__channel-icon';
        tgIcon.innerHTML = TELEGRAM_SVG;
        var tgText = document.createElement('span');
        tgText.textContent = labels.chanTelegram;
        telegramBtn.appendChild(tgIcon);
        telegramBtn.appendChild(tgText);
        formEl.appendChild(telegramBtn);

        if (labels.chanTelegramSub) {
          var tgSub = document.createElement('div');
          tgSub.className = 'form__channel-sub';
          tgSub.textContent = labels.chanTelegramSub;
          formEl.appendChild(tgSub);
        }
      }

      if (whatsappNumber) {
        whatsappBtn = document.createElement('button');
        whatsappBtn.type = 'button';
        whatsappBtn.className = 'form__channel form__channel--whatsapp';
        var waIcon = document.createElement('span');
        waIcon.className = 'form__channel-icon';
        waIcon.innerHTML = WHATSAPP_SVG;
        var waText = document.createElement('span');
        waText.textContent = labels.chanWhatsApp;
        whatsappBtn.appendChild(waIcon);
        whatsappBtn.appendChild(waText);
        formEl.appendChild(whatsappBtn);
      }

      if (googleClientId) {
        googleBtn = document.createElement('button');
        googleBtn.type = 'button';
        googleBtn.className = 'form__channel form__channel--google';
        var gIcon = document.createElement('span');
        gIcon.className = 'form__channel-icon';
        gIcon.innerHTML = GOOGLE_SVG;
        var gText = document.createElement('span');
        gText.textContent = labels.chanGoogle;
        googleBtn.appendChild(gIcon);
        googleBtn.appendChild(gText);
        formEl.appendChild(googleBtn);
      }

      topErrorEl = document.createElement('div');
      topErrorEl.className = 'form__error';
      formEl.appendChild(topErrorEl);

      var dividerEl = document.createElement('div');
      dividerEl.className = 'form__divider';
      dividerEl.textContent = labels.formDivider;
      formEl.appendChild(dividerEl);

      emailDetails = document.createElement('details');
      emailDetails.className = 'form__manual';
      var emailSummary = document.createElement('summary');
      emailSummary.textContent = labels.emailExpand;
      emailDetails.appendChild(emailSummary);

      var emailBody = document.createElement('div');
      emailBody.className = 'form__manual-body';

      emailInput = document.createElement('input');
      emailInput.className = 'form__input';
      emailInput.type = 'email';
      emailInput.autocomplete = 'email';
      emailInput.placeholder = labels.emailPlaceholder;
      emailInput.setAttribute('aria-label', labels.emailPlaceholder);

      errorEl = document.createElement('div');
      errorEl.className = 'form__error';

      var actionsEl = document.createElement('div');
      actionsEl.className = 'form__actions';

      cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'form__btn form__btn--cancel';
      cancelBtn.textContent = labels.formCancel;

      submitBtn = document.createElement('button');
      submitBtn.type = 'submit';
      submitBtn.className = 'form__btn form__btn--submit';
      submitBtn.textContent = labels.formSubmit;
      submitBtn.disabled = true;

      actionsEl.appendChild(cancelBtn);
      actionsEl.appendChild(submitBtn);

      emailBody.appendChild(emailInput);
      emailBody.appendChild(errorEl);
      emailBody.appendChild(actionsEl);
      emailDetails.appendChild(emailBody);
      formEl.appendChild(emailDetails);

      if (receiptEnabled) {
        // receipt-link panel — slug is regenerated every time the form opens
        var receiptDivider = document.createElement('div');
        receiptDivider.className = 'form__divider';
        receiptDivider.textContent = labels.formDivider;
        formEl.appendChild(receiptDivider);

        receiptEl = document.createElement('div');
        receiptEl.className = 'form__receipt';

        var receiptLabel = document.createElement('div');
        receiptLabel.className = 'form__receipt-label';
        receiptLabel.innerHTML = PIN_SVG + '<span></span>';
        receiptLabel.querySelector('span').textContent = labels.receiptLabel;

        var receiptRow = document.createElement('div');
        receiptRow.className = 'form__receipt-row';

        receiptUrlEl = document.createElement('div');
        receiptUrlEl.className = 'form__receipt-url';
        receiptUrlEl.setAttribute('title', '');

        receiptCopyBtn = document.createElement('button');
        receiptCopyBtn.type = 'button';
        receiptCopyBtn.className = 'form__receipt-copy';
        receiptCopyBtn.textContent = labels.receiptCopy;

        receiptRow.appendChild(receiptUrlEl);
        receiptRow.appendChild(receiptCopyBtn);
        receiptEl.appendChild(receiptLabel);
        receiptEl.appendChild(receiptRow);
        formEl.appendChild(receiptEl);
      }

      var footerEl = document.createElement('div');
      footerEl.className = 'form__footer';
      footerEl.textContent = labels.formFooter;
      formEl.appendChild(footerEl);

      wrap.appendChild(formEl);

      if (receiptEnabled) {
        // post-submit success panel — only used when receipt links are on
        successEl = document.createElement('div');
        successEl.className = 'success';

        successCloseBtn = document.createElement('button');
        successCloseBtn.type = 'button';
        successCloseBtn.className = 'success__close';
        successCloseBtn.setAttribute('aria-label', labels.formClose);
        successCloseBtn.textContent = '×';

        var checkEl = document.createElement('span');
        checkEl.className = 'success__check';
        checkEl.innerHTML = CHECK_SVG;

        var successTitleEl = document.createElement('div');
        successTitleEl.className = 'success__title';
        successTitleEl.textContent = labels.successTitle;

        var successSubEl = document.createElement('div');
        successSubEl.className = 'success__sub';
        successSubEl.textContent = labels.successSubtitle;

        var successReceipt = document.createElement('div');
        successReceipt.className = 'form__receipt';
        var sLabel = document.createElement('div');
        sLabel.className = 'form__receipt-label';
        sLabel.innerHTML = PIN_SVG + '<span></span>';
        sLabel.querySelector('span').textContent = labels.receiptLabel;
        var sRow = document.createElement('div');
        sRow.className = 'form__receipt-row';
        successUrlEl = document.createElement('div');
        successUrlEl.className = 'form__receipt-url';
        successCopyBtn = document.createElement('button');
        successCopyBtn.type = 'button';
        successCopyBtn.className = 'form__receipt-copy';
        successCopyBtn.textContent = labels.receiptCopy;
        sRow.appendChild(successUrlEl);
        sRow.appendChild(successCopyBtn);
        successReceipt.appendChild(sLabel);
        successReceipt.appendChild(sRow);

        successEl.appendChild(successCloseBtn);
        successEl.appendChild(checkEl);
        successEl.appendChild(successTitleEl);
        successEl.appendChild(successSubEl);
        successEl.appendChild(successReceipt);
        wrap.appendChild(successEl);
      }
    }

    shadow.appendChild(wrap);

    var status = 'idle';
    var recorder = null;
    var stream = null;
    var chunks = [];
    var pendingBlob = null;

    function makeBarIconButton(svgMarkup, ariaLabel) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bar__icon';
      b.setAttribute('aria-label', ariaLabel);
      b.innerHTML = svgMarkup;
      return b;
    }

    function setChannelButtonsDisabled(disabled) {
      if (telegramBtn) telegramBtn.disabled = disabled;
      if (whatsappBtn) whatsappBtn.disabled = disabled;
      if (googleBtn) googleBtn.disabled = disabled;
      if (submitBtn) submitBtn.disabled = disabled || !(emailInput && emailInput.value.trim());
    }

    function stopWaves() {
      if (waveTimer) { clearTimeout(waveTimer); waveTimer = null; }
      while (waveRings.length) {
        var el = waveRings.pop();
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
    }
    if (waveRings.length) {
      var duration = typeof options.attentionDuration === 'number'
        ? options.attentionDuration
        : 6000;
      waveTimer = setTimeout(stopWaves, duration);
    }

    function setStatus(next, message) {
      status = next;
      labelEl.classList.toggle('err', next === 'error');
      labelEl.textContent =
        next === 'error' && message ? message : labels[next] || next;
      btn.disabled = next === 'uploading';
      if (next === 'recording') {
        ringPulse.style.display = '';
        iconWrap.innerHTML = STOP_SVG;
        btn.setAttribute('aria-label', 'Stop recording');
      } else {
        ringPulse.style.display = 'none';
        iconWrap.innerHTML = MIC_SVG;
        btn.setAttribute('aria-label', 'Start recording');
      }
      // In bar mode we hide the standalone label by default; surface it as
      // a chip during active states so the visitor still gets feedback.
      if (showBar) {
        var showStatus = next === 'recording' || next === 'uploading' || next === 'sent' || next === 'error';
        wrap.classList.toggle('show-status', showStatus);
      }
    }

    function cleanupStream() {
      if (stream) {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        stream = null;
      }
    }

    function flashThenIdle(next, message, ms) {
      setStatus(next, message);
      setTimeout(function () {
        if (status === next) setStatus('idle');
      }, ms);
    }

    function buildReceiptUrl(slug) {
      return backend + '/r/' + slug;
    }

    function attachCopyHandler(btn, getUrl) {
      btn.addEventListener('click', function () {
        var url = getUrl();
        if (!url) return;
        var done = function () {
          btn.textContent = labels.receiptCopied;
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = labels.receiptCopy;
            btn.classList.remove('copied');
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, function () { done(); });
        } else {
          try {
            var ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            done();
          } catch (_) {}
        }
      });
    }

    function showSuccess() {
      if (!successEl) {
        flashThenIdle('sent', null, 1800);
        return;
      }
      var url = currentSlug ? buildReceiptUrl(currentSlug) : '';
      successUrlEl.textContent = url;
      successUrlEl.setAttribute('title', url);
      successCopyBtn.textContent = labels.receiptCopy;
      successCopyBtn.classList.remove('copied');
      wrap.classList.remove('show-form');
      wrap.classList.add('show-success');
      setStatus('idle');
    }

    function hideSuccess() {
      wrap.classList.remove('show-success');
    }

    function showContactForm() {
      status = 'awaiting-contact';
      wrap.classList.add('show-form');
      if (errorEl) errorEl.textContent = '';
      if (topErrorEl) topErrorEl.textContent = '';
      if (emailInput) emailInput.value = '';
      if (emailDetails) emailDetails.open = false;
      setChannelButtonsDisabled(false);
      if (receiptEnabled && receiptEl && receiptUrlEl && receiptCopyBtn) {
        currentSlug = randomSlug(12);
        var url = buildReceiptUrl(currentSlug);
        receiptUrlEl.textContent = url;
        receiptUrlEl.setAttribute('title', url);
        receiptCopyBtn.textContent = labels.receiptCopy;
        receiptCopyBtn.classList.remove('copied');
      } else {
        currentSlug = '';
      }
    }

    function hideContactForm() {
      wrap.classList.remove('show-form');
    }

    function isValidEmail(s) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
    }

    function refreshSubmitState() {
      if (!submitBtn) return;
      var e = (emailInput.value || '').trim();
      submitBtn.disabled = !e;
      if (errorEl && errorEl.textContent && e) errorEl.textContent = '';
      if (emailInput.classList.contains('invalid') && (e === '' || isValidEmail(e))) {
        emailInput.classList.remove('invalid');
      }
    }

    function buildTelegramUrl() {
      return 'https://t.me/' + encodeURIComponent(telegramHandle);
    }

    function buildWhatsappUrl() {
      var num = whatsappNumber.replace(/^\+/, '');
      var text = labels.whatsappPrefilledText || '';
      var qs = text ? '?text=' + encodeURIComponent(text) : '';
      return 'https://wa.me/' + num + qs;
    }

    function upload(blob, payload) {
      setStatus('uploading');
      var form = new FormData();
      var ext = blob.type.indexOf('webm') >= 0
        ? 'webm'
        : blob.type.indexOf('mp4') >= 0
          ? 'm4a'
          : blob.type.indexOf('ogg') >= 0
            ? 'ogg'
            : 'bin';
      form.append('audio', blob, 'recording.' + ext);
      try {
        form.append('pageTitle', (document.title || '').slice(0, 300));
        form.append('pageUrl', (location.href || '').slice(0, 800));
      } catch (_) { /* sandboxed iframe: ignore */ }
      if (payload) {
        if (payload.channel) form.append('channel', payload.channel.slice(0, 30));
        if (payload.email) form.append('email', payload.email.slice(0, 200));
        if (payload.googleAccessToken) form.append('googleAccessToken', payload.googleAccessToken);
        if (payload.slug) form.append('slug', payload.slug.slice(0, 64));
      }

      return fetch(backend + '/api/upload', { method: 'POST', body: form })
        .then(function (resp) {
          if (!resp.ok) {
            return resp
              .json()
              .catch(function () {
                return {};
              })
              .then(function (data) {
                throw new Error(data.error || 'HTTP ' + resp.status);
              });
          }
          if (collectContact && receiptEnabled) {
            showSuccess();
          } else {
            flashThenIdle('sent', null, 3500);
          }
          return true;
        })
        .catch(function (err) {
          flashThenIdle('error', err && err.message ? err.message : 'Upload failed', 3000);
          return false;
        });
    }

    function submitFlow(channel, deepLinkUrl, extraPayload) {
      var blob = pendingBlob;
      if (!blob) return;
      pendingBlob = null;
      hideContactForm();
      if (deepLinkUrl) {
        // Open synchronously inside the click handler so popup blockers
        // don't kill it. Fire-and-forget the upload in parallel.
        try { window.open(deepLinkUrl, '_blank', 'noopener,noreferrer'); } catch (_) {}
      }
      var payload = { channel: channel };
      if (currentSlug) payload.slug = currentSlug;
      if (extraPayload) {
        for (var k in extraPayload) {
          if (extraPayload.hasOwnProperty(k)) payload[k] = extraPayload[k];
        }
      }
      upload(blob, payload);
    }

    function triggerGoogleSignIn() {
      if (topErrorEl) topErrorEl.textContent = '';
      loadGoogleSdk()
        .then(function () {
          if (
            !window.google ||
            !window.google.accounts ||
            !window.google.accounts.oauth2
          ) {
            throw new Error('Google SDK loaded but oauth2 unavailable');
          }
          var tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'openid email profile',
            callback: function (response) {
              if (!response || !response.access_token) {
                setChannelButtonsDisabled(false);
                if (topErrorEl) topErrorEl.textContent = labels.googleSignInError;
                return;
              }
              submitFlow('google', null, { googleAccessToken: response.access_token });
            },
            error_callback: function (err) {
              setChannelButtonsDisabled(false);
              if (topErrorEl) topErrorEl.textContent = labels.googleSignInError;
              if (window.console) console.error('[voice-to-us] google:', err);
            },
          });
          tokenClient.requestAccessToken({ prompt: '' });
        })
        .catch(function (err) {
          setChannelButtonsDisabled(false);
          if (topErrorEl) topErrorEl.textContent = labels.googleSignInError;
          if (window.console) console.error('[voice-to-us] google:', err);
        });
    }

    function startRecording() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        flashThenIdle('error', 'Microphone not supported', 3000);
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(function (s) {
          stream = s;
          chunks = [];
          var mime = 'audio/webm;codecs=opus';
          var rec =
            typeof MediaRecorder !== 'undefined' &&
            MediaRecorder.isTypeSupported &&
            MediaRecorder.isTypeSupported(mime)
              ? new MediaRecorder(s, { mimeType: mime })
              : new MediaRecorder(s);
          rec.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          rec.onstop = function () {
            var blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
            cleanupStream();
            if (collectContact) {
              pendingBlob = blob;
              showContactForm();
            } else {
              upload(blob, null);
            }
          };
          rec.start();
          recorder = rec;
          setStatus('recording');
        })
        .catch(function (err) {
          cleanupStream();
          flashThenIdle(
            'error',
            err && err.message ? err.message : 'Microphone access denied',
            3000,
          );
        });
    }

    function stopRecording() {
      var rec = recorder;
      recorder = null;
      if (rec && rec.state !== 'inactive') rec.stop();
    }

    btn.addEventListener('click', function () {
      stopWaves();
      hideSuccess();
      if (barEl) {
        barEl.classList.remove('show-menu');
        barEl.classList.remove('show-wechat');
      }
      if (status === 'recording') stopRecording();
      else if (status === 'idle' || status === 'sent' || status === 'error')
        startRecording();
    });

    if (collectContact) {
      emailInput.addEventListener('input', refreshSubmitState);

      function discardAndIdle() {
        pendingBlob = null;
        hideContactForm();
        setStatus('idle');
      }
      cancelBtn.addEventListener('click', discardAndIdle);
      formCloseBtn.addEventListener('click', discardAndIdle);

      if (telegramBtn) {
        telegramBtn.addEventListener('click', function () {
          setChannelButtonsDisabled(true);
          submitFlow('telegram', buildTelegramUrl());
        });
      }
      if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function () {
          setChannelButtonsDisabled(true);
          submitFlow('whatsapp', buildWhatsappUrl());
        });
      }
      if (googleBtn) {
        googleBtn.addEventListener('click', function () {
          setChannelButtonsDisabled(true);
          triggerGoogleSignIn();
        });
      }

      if (receiptCopyBtn) {
        attachCopyHandler(receiptCopyBtn, function () {
          return receiptUrlEl ? receiptUrlEl.textContent : '';
        });
      }
      if (successCopyBtn) {
        attachCopyHandler(successCopyBtn, function () {
          return successUrlEl ? successUrlEl.textContent : '';
        });
      }
      if (successCloseBtn) {
        successCloseBtn.addEventListener('click', function () {
          hideSuccess();
          setStatus('idle');
        });
      }

      formEl.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (emailInput.value || '').trim();
        if (!email) return;
        if (!isValidEmail(email)) {
          emailInput.classList.add('invalid');
          errorEl.textContent = labels.formInvalidEmail;
          emailInput.focus();
          return;
        }
        var blob = pendingBlob;
        pendingBlob = null;
        hideContactForm();
        upload(blob, { channel: 'email', email: email });
      });

      formEl.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          discardAndIdle();
        }
      });
    }

    return {
      destroy: function () {
        stopWaves();
        if (outsideClickHandler) document.removeEventListener('click', outsideClickHandler);
        if (escKeyHandler) document.removeEventListener('keydown', escKeyHandler);
        try {
          if (recorder && recorder.state !== 'inactive') recorder.stop();
        } catch (_) {}
        cleanupStream();
        pendingBlob = null;
        if (isFloating && root && root.parentNode) {
          root.parentNode.removeChild(root);
        } else {
          while (shadow.firstChild) shadow.removeChild(shadow.firstChild);
        }
      },
    };
  }

  function sanitizeHandle(s) {
    return String(s || '').trim().replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
  }

  // For the v0.1.9 floating-bar links: explicit '' / null / 'false' disables
  // a single link without affecting the others. Otherwise fall back to the
  // baked-in default.
  function pickLink(override, fallback) {
    if (override == null) return fallback;
    var s = String(override).trim();
    if (s === '' || s.toLowerCase() === 'false' || s.toLowerCase() === 'off') return '';
    return s;
  }

  function sanitizeNumber(s) {
    var v = String(s || '').replace(/[^\d+]/g, '');
    return v ? (v[0] === '+' ? v : '+' + v) : '';
  }

  function mergeDefaults(defaults, overrides) {
    var out = {};
    for (var k in defaults) if (defaults.hasOwnProperty(k)) out[k] = defaults[k];
    for (var j in overrides) {
      if (overrides.hasOwnProperty(j) && overrides[j] != null && overrides[j] !== '') {
        out[j] = overrides[j];
      }
    }
    return out;
  }

  function applyTheme(el, theme) {
    var size = typeof theme.size === 'number' ? theme.size + 'px' : String(theme.size);
    el.style.setProperty('--v2u-color', theme.color);
    el.style.setProperty('--v2u-text-color', theme.textColor);
    el.style.setProperty('--v2u-label-color', theme.labelColor);
    el.style.setProperty('--v2u-ring-color', theme.ringColor);
    el.style.setProperty('--v2u-ring-pulse-color', theme.ringPulseColor);
    el.style.setProperty('--v2u-error-color', theme.errorColor);
    el.style.setProperty('--v2u-size', size);
  }

  function readThemeFromScript(script) {
    var theme = {};
    var map = {
      color: 'data-color',
      textColor: 'data-text-color',
      labelColor: 'data-label-color',
      ringColor: 'data-ring-color',
      ringPulseColor: 'data-ring-pulse-color',
      errorColor: 'data-error-color',
      size: 'data-size',
    };
    for (var key in map) {
      var v = script.getAttribute(map[key]);
      if (v != null && v !== '') {
        theme[key] = key === 'size' ? parseInt(v, 10) : v;
      }
    }
    return theme;
  }

  function readLabelsFromScript(script) {
    var labels = {};
    var map = {
      idle: 'data-label-idle',
      recording: 'data-label-recording',
      uploading: 'data-label-uploading',
      sent: 'data-label-sent',
      error: 'data-label-error',
      formTitle: 'data-label-form-title',
      chanTelegram: 'data-label-chan-telegram',
      chanTelegramSub: 'data-label-chan-telegram-sub',
      chanWhatsApp: 'data-label-chan-whatsapp',
      formDivider: 'data-label-form-divider',
      emailExpand: 'data-label-email-expand',
      emailPlaceholder: 'data-label-email-placeholder',
      formSubmit: 'data-label-form-submit',
      formCancel: 'data-label-form-cancel',
      formClose: 'data-label-form-close',
      formInvalidEmail: 'data-label-form-invalid-email',
      formFooter: 'data-label-form-footer',
      whatsappPrefilledText: 'data-label-whatsapp-prefilled',
    };
    for (var key in map) {
      var v = script.getAttribute(map[key]);
      if (v != null && v !== '') labels[key] = v;
    }
    return labels;
  }

  function autoInit() {
    var script = document.currentScript;
    if (!script) return;
    var backend = script.getAttribute('data-backend');
    if (!backend) return;
    var floating = script.getAttribute('data-floating') === 'true';
    var mountSel = script.getAttribute('data-mount');
    var placement = script.getAttribute('data-placement');
    var theme = readThemeFromScript(script);
    var labels = readLabelsFromScript(script);

    var attentionAttr = script.getAttribute('data-attention');
    var attentionDurAttr = script.getAttribute('data-attention-duration');
    var collectContactAttr = script.getAttribute('data-collect-contact');
    var telegramHandleAttr = script.getAttribute('data-telegram-handle');
    var whatsappNumberAttr = script.getAttribute('data-whatsapp-number');
    var googleClientIdAttr = script.getAttribute('data-google-client-id');
    var receiptEnabledAttr = script.getAttribute('data-receipt-enabled');
    var showBarAttr = script.getAttribute('data-show-bar');
    var linkTwitterAttr = script.getAttribute('data-link-twitter');
    var linkLinkedinAttr = script.getAttribute('data-link-linkedin');
    var linkGithubAttr = script.getAttribute('data-link-github');
    var linkGmicaiAttr = script.getAttribute('data-link-gmicai');
    var linkEmailAttr = script.getAttribute('data-link-email');
    var wechatQrUrlAttr = script.getAttribute('data-wechat-qr-url');

    var run = function () {
      try {
        var opts = { backend: backend, theme: theme, labels: labels };
        if (placement) opts.placement = placement;
        if (attentionAttr === 'false') opts.attention = false;
        if (attentionDurAttr) {
          var n = parseInt(attentionDurAttr, 10);
          if (!isNaN(n)) opts.attentionDuration = n;
        }
        if (collectContactAttr === 'false') opts.collectContact = false;
        if (telegramHandleAttr != null) opts.telegramHandle = telegramHandleAttr;
        if (whatsappNumberAttr != null) opts.whatsappNumber = whatsappNumberAttr;
        if (googleClientIdAttr != null) opts.googleClientId = googleClientIdAttr;
        if (receiptEnabledAttr === 'true') opts.receiptEnabled = true;
        if (showBarAttr === 'false') opts.showBar = false;
        if (linkTwitterAttr != null) opts.linkTwitter = linkTwitterAttr;
        if (linkLinkedinAttr != null) opts.linkLinkedin = linkLinkedinAttr;
        if (linkGithubAttr != null) opts.linkGithub = linkGithubAttr;
        if (linkGmicaiAttr != null) opts.linkGmicai = linkGmicaiAttr;
        if (linkEmailAttr != null) opts.linkEmail = linkEmailAttr;
        if (wechatQrUrlAttr != null) opts.wechatQrUrl = wechatQrUrlAttr;
        if (floating) {
          opts.floating = true;
          mount(document.body, opts);
        } else if (mountSel) {
          mount(mountSel, opts);
        }
      } catch (err) {
        if (window.console) console.error('[voice-to-us]', err);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }

  window.VoiceToUs = { mount: mount, version: '0.1.10' };
  autoInit();
})();
