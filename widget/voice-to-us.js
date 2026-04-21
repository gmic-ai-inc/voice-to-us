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
  };

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
    '.icon{display:flex;align-items:center;justify-content:center;width:calc(var(--v2u-size) * 0.4);height:calc(var(--v2u-size) * 0.4);line-height:0}',
    '.icon svg{width:100%;height:100%;display:block}',
    /* floating mode: tighter layout, no idle outer ring, smaller defaults */
    '.wrap.floating{gap:.4rem;flex-direction:column-reverse;align-items:flex-end}',
    '.wrap.floating .btn{box-shadow:0 4px 14px rgba(0,0,0,.18)}',
    '.wrap.floating .ring:not(.pulse){display:none}',
    '.wrap.floating .ring.pulse{inset:calc(var(--v2u-size) * -0.14)}',
    '.wrap.floating .label{background:#fff;color:#222;border:none;box-shadow:0 2px 8px rgba(0,0,0,.08);font-size:.78rem;min-width:0;padding:.28rem .65rem;border-radius:999px}',
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
        'position:fixed;right:24px;bottom:24px;z-index:2147483647;margin:0;padding:0;';
      document.body.appendChild(root);
    }

    applyTheme(root, theme);

    var shadow = root.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'wrap' + (isFloating ? ' floating' : '');

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
    btn.appendChild(iconWrap);
    wrap.appendChild(labelEl);
    wrap.appendChild(btn);
    shadow.appendChild(wrap);

    var status = 'idle';
    var recorder = null;
    var stream = null;
    var chunks = [];

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

    function upload(blob) {
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
          flashThenIdle('sent', null, 1800);
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
            upload(blob);
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
      if (status === 'recording') stopRecording();
      else if (status === 'idle' || status === 'sent' || status === 'error')
        startRecording();
    });

    return {
      destroy: function () {
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
    var theme = readThemeFromScript(script);
    var labels = readLabelsFromScript(script);

    var run = function () {
      try {
        var opts = { backend: backend, theme: theme, labels: labels };
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

  window.VoiceToUs = { mount: mount, version: '0.2.0' };
  autoInit();
})();
