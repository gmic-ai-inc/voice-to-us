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
    sent: 'Sent!',
    error: 'Error',
    formTitle: 'Leave a way to reach you',
    formHint: 'Email or phone — at least one (so we can reply).',
    emailPlaceholder: 'Email (optional)',
    phonePlaceholder: 'Phone (optional)',
    formSubmit: 'Send',
    formCancel: 'Cancel',
    formInvalidEmail: 'That email looks off',
    ctaTitle: 'Tap below to start your AI demo call.',
    ctaButton: 'Call (669) 900-0008',
    ctaReportPrefix: 'Report will be texted to',
    ctaStep1: '<b>AI picks up</b> instantly',
    ctaStep2: '<b>Describe any job</b> — talk naturally',
    ctaStep3: '<b>Get a text</b> with your work order',
    ctaClose: 'Close',
  };

  var DEFAULT_CTA_URL = 'tel:+16699000008';

  var PHONE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>' +
    '</svg>';

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
    '.form{display:none;flex-direction:column;gap:.6rem;width:280px;max-width:90vw;padding:1rem 1.1rem;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.08);box-sizing:border-box}',
    '.wrap.show-form .form{display:flex}',
    '.wrap.show-form .label,.wrap.show-form .btn{display:none}',
    '.form__title{font-size:.95rem;font-weight:600;color:#111;margin:0}',
    '.form__hint{font-size:.78rem;color:#6b7280;margin:0}',
    '.form__input{appearance:none;font:inherit;font-size:.9rem;padding:.55rem .7rem;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#111;outline:none;width:100%;box-sizing:border-box}',
    '.form__input:focus{border-color:var(--v2u-color);box-shadow:0 0 0 3px rgba(0,0,0,.06)}',
    '.form__input.invalid{border-color:var(--v2u-error-color)}',
    '.form__error{font-size:.75rem;color:var(--v2u-error-color);margin:0;min-height:1em}',
    '.form__actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.2rem}',
    '.form__btn{font:inherit;font-size:.85rem;padding:.45rem .9rem;border-radius:6px;border:1px solid transparent;cursor:pointer;background:#fff}',
    '.form__btn--cancel{color:#374151;border-color:#d1d5db}',
    '.form__btn--cancel:hover{background:#f3f4f6}',
    '.form__btn--submit{background:var(--v2u-color);color:var(--v2u-text-color);border-color:var(--v2u-color)}',
    '.form__btn--submit:disabled{opacity:.45;cursor:not-allowed}',
    '.form__btn--submit:not(:disabled):hover{filter:brightness(.92)}',
    /* demo-call CTA shown after a successful upload */
    '.cta{display:none;flex-direction:column;align-items:stretch;gap:.85rem;width:320px;max-width:92vw;padding:1.25rem 1.1rem 1.1rem;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.08);position:relative;box-sizing:border-box;text-align:center}',
    '.wrap.show-cta .cta{display:flex}',
    '.wrap.show-cta .label{display:none}',
    '.cta__close{position:absolute;top:.45rem;right:.5rem;background:none;border:none;font-size:1.15rem;line-height:1;color:#9ca3af;cursor:pointer;padding:.15rem .4rem;border-radius:4px}',
    '.cta__close:hover{background:#f3f4f6;color:#374151}',
    '.cta__title{font-size:.92rem;font-weight:500;color:#374151;margin:0 1rem;line-height:1.4}',
    '.cta__btn{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;padding:.85rem 1rem;background:#22c55e;color:#fff;border-radius:9999px;font:inherit;font-size:1.05rem;font-weight:600;text-decoration:none;box-shadow:0 8px 24px rgba(34,197,94,.35);transition:filter .12s,transform .1s}',
    '.cta__btn:hover{filter:brightness(.96);text-decoration:none;color:#fff}',
    '.cta__btn:active{transform:scale(.98)}',
    '.cta__btn-icon{width:1.2em;height:1.2em;display:inline-block;flex:none}',
    '.cta__sub{font-size:.78rem;color:#6b7280;margin:0;line-height:1.4}',
    '.cta__sub b{color:#374151;font-weight:600}',
    '.cta__steps{display:flex;flex-direction:column;gap:.55rem;margin:.4rem 0 0;padding:0;list-style:none;text-align:left}',
    '.cta__step{display:flex;align-items:center;gap:.65rem;font-size:.85rem;color:#374151}',
    '.cta__step-num{flex:none;width:1.55rem;height:1.55rem;border-radius:9999px;background:#f3f4f6;color:#374151;font-size:.78rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center}',
    '.cta__step b{color:#111;font-weight:600}',
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
    wrap.appendChild(btn);

    var collectContact = options.collectContact !== false;

    var formEl = null;
    var emailInput = null;
    var phoneInput = null;
    var submitBtn = null;
    var cancelBtn = null;
    var errorEl = null;
    if (collectContact) {
      formEl = document.createElement('form');
      formEl.className = 'form';
      formEl.setAttribute('novalidate', '');

      var titleEl = document.createElement('div');
      titleEl.className = 'form__title';
      titleEl.textContent = labels.formTitle;

      var hintEl = document.createElement('div');
      hintEl.className = 'form__hint';
      hintEl.textContent = labels.formHint;

      emailInput = document.createElement('input');
      emailInput.className = 'form__input';
      emailInput.type = 'email';
      emailInput.autocomplete = 'email';
      emailInput.placeholder = labels.emailPlaceholder;
      emailInput.setAttribute('aria-label', labels.emailPlaceholder);

      phoneInput = document.createElement('input');
      phoneInput.className = 'form__input';
      phoneInput.type = 'tel';
      phoneInput.autocomplete = 'tel';
      phoneInput.placeholder = labels.phonePlaceholder;
      phoneInput.setAttribute('aria-label', labels.phonePlaceholder);

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

      formEl.appendChild(titleEl);
      formEl.appendChild(hintEl);
      formEl.appendChild(emailInput);
      formEl.appendChild(phoneInput);
      formEl.appendChild(errorEl);
      formEl.appendChild(actionsEl);
      wrap.appendChild(formEl);
    }

    var ctaUrl = (options.ctaUrl != null && options.ctaUrl !== '')
      ? String(options.ctaUrl)
      : DEFAULT_CTA_URL;
    var ctaEnabled = options.ctaEnabled !== false && !!ctaUrl;
    var ctaEl = null;
    var ctaSubEl = null;
    if (ctaEnabled) {
      ctaEl = document.createElement('div');
      ctaEl.className = 'cta';
      ctaEl.setAttribute('role', 'dialog');
      ctaEl.setAttribute('aria-label', labels.ctaTitle);

      var ctaCloseBtn = document.createElement('button');
      ctaCloseBtn.type = 'button';
      ctaCloseBtn.className = 'cta__close';
      ctaCloseBtn.setAttribute('aria-label', labels.ctaClose);
      ctaCloseBtn.textContent = '×';

      var ctaTitleEl = document.createElement('div');
      ctaTitleEl.className = 'cta__title';
      ctaTitleEl.textContent = labels.ctaTitle;

      var ctaLink = document.createElement('a');
      ctaLink.className = 'cta__btn';
      ctaLink.href = ctaUrl;
      ctaLink.rel = 'noopener noreferrer';
      if (!/^tel:|^sms:|^mailto:/i.test(ctaUrl)) ctaLink.target = '_blank';
      var ctaIcon = document.createElement('span');
      ctaIcon.className = 'cta__btn-icon';
      ctaIcon.innerHTML = PHONE_SVG;
      var ctaLabel = document.createElement('span');
      ctaLabel.textContent = labels.ctaButton;
      ctaLink.appendChild(ctaIcon);
      ctaLink.appendChild(ctaLabel);

      ctaSubEl = document.createElement('div');
      ctaSubEl.className = 'cta__sub';
      ctaSubEl.style.display = 'none';

      var stepsList = document.createElement('ol');
      stepsList.className = 'cta__steps';
      [labels.ctaStep1, labels.ctaStep2, labels.ctaStep3].forEach(function (text, i) {
        var li = document.createElement('li');
        li.className = 'cta__step';
        var num = document.createElement('span');
        num.className = 'cta__step-num';
        num.textContent = String(i + 1);
        var body = document.createElement('span');
        body.innerHTML = text; // labels are author-controlled; <b> tags expected
        li.appendChild(num);
        li.appendChild(body);
        stepsList.appendChild(li);
      });

      ctaEl.appendChild(ctaCloseBtn);
      ctaEl.appendChild(ctaTitleEl);
      ctaEl.appendChild(ctaLink);
      ctaEl.appendChild(ctaSubEl);
      ctaEl.appendChild(stepsList);
      wrap.appendChild(ctaEl);

      ctaCloseBtn.addEventListener('click', function () {
        wrap.classList.remove('show-cta');
      });
    }

    shadow.appendChild(wrap);

    var status = 'idle';
    var recorder = null;
    var stream = null;
    var chunks = [];
    var pendingBlob = null;
    var lastContactPhone = '';

    function showCta() {
      if (!ctaEl) return;
      if (ctaSubEl) {
        if (lastContactPhone) {
          ctaSubEl.innerHTML =
            escapeHtml(labels.ctaReportPrefix) + ' <b>' + escapeHtml(lastContactPhone) + '</b>';
          ctaSubEl.style.display = '';
        } else {
          ctaSubEl.style.display = 'none';
        }
      }
      wrap.classList.add('show-cta');
    }

    function hideCta() {
      if (ctaEl) wrap.classList.remove('show-cta');
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    function showContactForm() {
      status = 'awaiting-contact';
      wrap.classList.add('show-form');
      if (errorEl) errorEl.textContent = '';
      if (emailInput) emailInput.value = '';
      if (phoneInput) phoneInput.value = '';
      if (submitBtn) submitBtn.disabled = true;
      setTimeout(function () { if (emailInput) emailInput.focus(); }, 0);
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
      var p = (phoneInput.value || '').trim();
      submitBtn.disabled = !(e || p);
      if (errorEl && errorEl.textContent && (e || p)) errorEl.textContent = '';
      if (emailInput.classList.contains('invalid') && (e === '' || isValidEmail(e))) {
        emailInput.classList.remove('invalid');
      }
    }

    function upload(blob, contact) {
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
      if (contact) {
        if (contact.email) form.append('email', contact.email.slice(0, 200));
        if (contact.phone) form.append('phone', contact.phone.slice(0, 50));
      }

      fetch(backend + '/api/upload', { method: 'POST', body: form })
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
          if (ctaEnabled) {
            setStatus('idle');
            showCta();
          } else {
            flashThenIdle('sent', null, 1800);
          }
        })
        .catch(function (err) {
          flashThenIdle('error', err && err.message ? err.message : 'Upload failed', 3000);
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
      hideCta();
      if (status === 'recording') stopRecording();
      else if (status === 'idle' || status === 'sent' || status === 'error')
        startRecording();
    });

    if (collectContact) {
      emailInput.addEventListener('input', refreshSubmitState);
      phoneInput.addEventListener('input', refreshSubmitState);

      cancelBtn.addEventListener('click', function () {
        pendingBlob = null;
        hideContactForm();
        setStatus('idle');
      });

      formEl.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (emailInput.value || '').trim();
        var phone = (phoneInput.value || '').trim();
        if (!email && !phone) return;
        if (email && !isValidEmail(email)) {
          emailInput.classList.add('invalid');
          errorEl.textContent = labels.formInvalidEmail;
          emailInput.focus();
          return;
        }
        var blob = pendingBlob;
        pendingBlob = null;
        lastContactPhone = phone;
        hideContactForm();
        upload(blob, { email: email, phone: phone });
      });

      formEl.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelBtn.click();
        }
      });
    }

    return {
      destroy: function () {
        stopWaves();
        try {
          if (recorder && recorder.state !== 'inactive') recorder.stop();
        } catch (_) {}
        cleanupStream();
        if (isFloating && root && root.parentNode) {
          root.parentNode.removeChild(root);
        } else {
          while (shadow.firstChild) shadow.removeChild(shadow.firstChild);
        }
      },
    };
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
      formHint: 'data-label-form-hint',
      emailPlaceholder: 'data-label-email-placeholder',
      phonePlaceholder: 'data-label-phone-placeholder',
      formSubmit: 'data-label-form-submit',
      formCancel: 'data-label-form-cancel',
      formInvalidEmail: 'data-label-form-invalid-email',
      ctaTitle: 'data-label-cta-title',
      ctaButton: 'data-label-cta-button',
      ctaReportPrefix: 'data-label-cta-report-prefix',
      ctaStep1: 'data-label-cta-step-1',
      ctaStep2: 'data-label-cta-step-2',
      ctaStep3: 'data-label-cta-step-3',
      ctaClose: 'data-label-cta-close',
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
    var ctaUrlAttr = script.getAttribute('data-cta-url');
    var ctaEnabledAttr = script.getAttribute('data-cta-enabled');

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
        if (ctaEnabledAttr === 'false') opts.ctaEnabled = false;
        if (ctaUrlAttr) opts.ctaUrl = ctaUrlAttr;
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

  window.VoiceToUs = { mount: mount, version: '0.1.3' };
  autoInit();
})();
