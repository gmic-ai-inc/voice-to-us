import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { sendVoiceToAllTargets, getTargets } from './telegram.js';
import { verifyGoogleAccessToken } from './google-auth.js';
import {
  saveSubmission,
  loadSubmission,
  updateSubmission,
  isValidSlug,
  isValidAdminToken,
  generateAdminToken,
} from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetDir = path.resolve(__dirname, '../../widget');

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const rawOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3100';
const allowList = rawOrigin.split(',').map((s) => s.trim()).filter(Boolean);
const corsOrigin =
  allowList.length === 1 && allowList[0] === '*' ? true : allowList;

app.use(cors({ origin: corsOrigin }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

function publicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return String(process.env.PUBLIC_BASE_URL).replace(/\/+$/, '');
  }
  // Dev fallback when PUBLIC_BASE_URL isn't set.
  const proto = (req && req.protocol) || 'http';
  const host = (req && req.get && req.get('host')) || `localhost:${process.env.PORT ?? 4000}`;
  return `${proto}://${host}`;
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/widget.js', (_req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(widgetDir, 'voice-to-us.js'));
});

app.get('/wechat-qr.png', (_req, res) => {
  res.type('image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(widgetDir, 'wechat-qr.png'));
});

app.get('/widget-demo', (_req, res) => {
  res.sendFile(path.join(widgetDir, 'demo.html'));
});

app.post('/api/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Missing "audio" file field' });
    return;
  }

  // If the visitor signed in with Google, verify the access token server-side
  // (audience check + email lookup) and override the email field with the
  // verified value — we don't trust client-supplied emails when Google
  // attests to one.
  let email = req.body?.email;
  let googleName = null;
  if (req.body?.googleAccessToken) {
    try {
      const g = await verifyGoogleAccessToken(req.body.googleAccessToken);
      email = g.email;
      googleName = g.name || null;
    } catch (err) {
      console.warn('[google-auth] verification failed:', err?.message ?? err);
      res.status(400).json({ error: 'Google sign-in verification failed' });
      return;
    }
  }

  const slug = req.body?.slug;
  const hasSlug = slug && isValidSlug(slug);
  const adminToken = hasSlug ? generateAdminToken() : null;
  const adminUrl = hasSlug
    ? `${publicBaseUrl(req)}/r/${slug}/admin/${adminToken}`
    : null;

  try {
    const result = await sendVoiceToAllTargets({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      context: {
        pageTitle: req.body?.pageTitle,
        pageUrl: req.body?.pageUrl,
        email: email,
        phone: req.body?.phone,
        channel: req.body?.channel,
        googleName: googleName,
        adminUrl: adminUrl,
      },
    });

    // Persist a receipt record so the visitor can revisit /r/<slug> later.
    if (hasSlug) {
      try {
        await saveSubmission(slug, {
          slug,
          adminToken,
          createdAt: new Date().toISOString(),
          pageTitle: req.body?.pageTitle ?? null,
          pageUrl: req.body?.pageUrl ?? null,
          channel: req.body?.channel ?? null,
          email: email ?? null,
          phone: req.body?.phone ?? null,
          googleName: googleName,
          status: 'received',
          delivered: result.sent.length,
          failed: result.failed.length,
          reply: null,
          repliedAt: null,
        });
      } catch (err) {
        console.warn('[storage] saveSubmission failed:', err?.message ?? err);
      }
    }

    res.json({
      ok: true,
      delivered: result.sent.length,
      failed: result.failed.length,
      slug: slug && isValidSlug(slug) ? slug : null,
    });
  } catch (err) {
    console.error('[upload] failed:', err);
    const message = err instanceof Error ? err.message : 'Send failed';
    res.status(500).json({ error: message });
  }
});

app.get('/r/:slug', async (req, res) => {
  const { slug } = req.params;
  const baseUrl = publicBaseUrl(req);
  if (!isValidSlug(slug)) {
    res.status(400).type('text/html').send(renderReceiptPage(null, slug, 'invalid', baseUrl));
    return;
  }
  const record = await loadSubmission(slug).catch(() => null);
  if (!record) {
    res.status(404).type('text/html').send(renderReceiptPage(null, slug, 'missing', baseUrl));
    return;
  }
  res.type('text/html').send(renderReceiptPage(record, slug, 'ok', baseUrl));
});

// Admin reply form. Token is in the URL (printed in the Telegram caption,
// only the boss sees it). No additional auth — token possession = authority.
app.get('/r/:slug/admin/:token', async (req, res) => {
  const { slug, token } = req.params;
  const baseUrl = publicBaseUrl(req);
  if (!isValidSlug(slug) || !isValidAdminToken(token)) {
    res.status(400).type('text/html').send(renderShellHtml('Reply', '<main class="card"><p>Invalid admin link.</p></main>', baseUrl));
    return;
  }
  const record = await loadSubmission(slug).catch(() => null);
  if (!record || record.adminToken !== token) {
    res.status(404).type('text/html').send(renderShellHtml('Reply', '<main class="card"><p>Admin link not found or no longer valid.</p></main>', baseUrl));
    return;
  }
  const flash = req.query.ok === '1' ? 'sent' : null;
  res.type('text/html').send(renderAdminPage(record, slug, token, flash, null, baseUrl));
});

app.post('/r/:slug/admin/:token', async (req, res) => {
  const { slug, token } = req.params;
  const baseUrl = publicBaseUrl(req);
  if (!isValidSlug(slug) || !isValidAdminToken(token)) {
    res.status(400).type('text/html').send(renderShellHtml('Reply', '<main class="card"><p>Invalid admin link.</p></main>', baseUrl));
    return;
  }
  const record = await loadSubmission(slug).catch(() => null);
  if (!record || record.adminToken !== token) {
    res.status(404).type('text/html').send(renderShellHtml('Reply', '<main class="card"><p>Admin link not found or no longer valid.</p></main>', baseUrl));
    return;
  }
  const reply = (req.body?.reply ?? '').toString().trim();
  if (!reply) {
    res.status(400).type('text/html').send(renderAdminPage(record, slug, token, null, 'Reply cannot be empty.', baseUrl));
    return;
  }
  if (reply.length > 5000) {
    res.status(400).type('text/html').send(renderAdminPage(record, slug, token, null, 'Reply too long (max 5000 characters).', baseUrl));
    return;
  }
  try {
    await updateSubmission(slug, {
      reply,
      repliedAt: new Date().toISOString(),
      status: 'replied',
    });
  } catch (err) {
    console.warn('[admin] reply write failed:', err?.message ?? err);
    res.status(500).type('text/html').send(renderAdminPage(record, slug, token, null, 'Could not save the reply. Try again.', baseUrl));
    return;
  }
  // Relative redirect — browser resolves against current URL, so the proxy
  // prefix (e.g. /voice2us) is preserved without us hard-coding it.
  res.redirect(303, '?ok=1');
});

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const RECEIPT_CSS = `*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#fafafb;color:#111;padding:3rem 1rem;line-height:1.55;-webkit-font-smoothing:antialiased}.card{max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:1.75rem 1.6rem;box-shadow:0 8px 24px rgba(0,0,0,.04)}.card+.card{margin-top:1rem}.eyebrow{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#9ca3af;margin:0 0 .35rem}h1{font-size:1.3rem;margin:0 0 .9rem;letter-spacing:-.01em}h2{font-size:1.05rem;margin:0 0 .65rem;letter-spacing:-.005em}.row{display:flex;justify-content:space-between;align-items:baseline;font-size:.88rem;padding:.5rem 0;border-top:1px solid #f1f3f5}.row:first-child{border-top:none}.row dt{color:#6b7280;font-weight:400;margin:0}.row dd{margin:0;color:#111;font-weight:500;text-align:right;word-break:break-word;max-width:60%}.status-pill{display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .6rem;border-radius:9999px;background:#ecfdf5;color:#047857;font-size:.78rem;font-weight:500}.status-pill.pending{background:#fef3c7;color:#92400e}.status-pill.error{background:#fee2e2;color:#991b1b}.muted{color:#6b7280;font-size:.85rem;margin:0 0 1rem}.reply-block{padding:.9rem 1rem;background:#f9fafb;border-left:3px solid #6366f1;border-radius:6px;white-space:pre-wrap;font-size:.9rem;color:#1f2937;margin:0 0 .4rem}.reply-when{font-size:.75rem;color:#9ca3af;margin:0}textarea.reply-input{width:100%;min-height:140px;padding:.7rem .8rem;border:1px solid #d1d5db;border-radius:8px;font:inherit;font-size:.92rem;resize:vertical;outline:none}textarea.reply-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}.btn-primary{display:inline-block;padding:.55rem 1.1rem;background:#111;color:#fff;border:none;border-radius:8px;font:inherit;font-size:.9rem;font-weight:500;cursor:pointer}.btn-primary:hover{background:#222}.flash{padding:.65rem .9rem;border-radius:8px;font-size:.85rem;margin:0 0 1rem}.flash.ok{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}.flash.err{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}footer{text-align:center;color:#9ca3af;font-size:.75rem;margin-top:1.25rem}`;

function renderShellHtml(title, bodyHtml, baseUrl) {
  const demoHref = `${baseUrl || ''}/widget-demo`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>${RECEIPT_CSS}</style></head><body>${bodyHtml}<footer>voice-to-us · <a href="${escapeHtml(demoHref)}" style="color:inherit">demo</a></footer></body></html>`;
}

function metadataRowsHtml(record) {
  const dt = new Date(record.createdAt);
  const when = isNaN(dt.getTime()) ? record.createdAt : dt.toLocaleString();
  const channel = (record.channel || '—').toString();
  return [
    ['Received', escapeHtml(when)],
    ['Reply via', escapeHtml(channel)],
    record.googleName ? ['Name', escapeHtml(record.googleName)] : null,
    record.email ? ['Email', escapeHtml(record.email)] : null,
    record.phone ? ['Phone', escapeHtml(record.phone)] : null,
    record.pageTitle ? ['From page', escapeHtml(record.pageTitle)] : null,
  ]
    .filter(Boolean)
    .map(([k, v]) => `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');
}

function renderReceiptPage(record, slug, state, baseUrl) {
  const title = 'Voice note receipt';

  let main;
  if (state === 'invalid') {
    main = `<main class="card"><p class="eyebrow">Receipt link</p><h1>This link doesn't look right</h1><p class="muted">The link "<code>${escapeHtml(slug)}</code>" isn't a valid receipt id. Double-check the URL you saved.</p></main>`;
  } else if (state === 'missing') {
    main = `<main class="card"><p class="eyebrow">Receipt link</p><h1>Nothing here yet</h1><p class="muted">This receipt id (<code>${escapeHtml(slug)}</code>) hasn't been used. If you just left a voice note and the upload is still in progress, refresh this page in a moment. If you closed the widget before sending, the recording was discarded.</p></main>`;
  } else {
    const delivered = Number(record.delivered ?? 0);
    const hasReply = !!record.reply;
    const statusClass = hasReply ? '' : delivered > 0 ? 'pending' : 'pending';
    const statusText = hasReply ? 'Reply received' : delivered > 0 ? 'Awaiting reply' : 'Pending';
    const rows = metadataRowsHtml(record);

    let replyCard = '';
    if (hasReply) {
      const repliedDt = record.repliedAt ? new Date(record.repliedAt) : null;
      const repliedWhen = repliedDt && !isNaN(repliedDt.getTime())
        ? repliedDt.toLocaleString()
        : (record.repliedAt || '');
      replyCard = `<section class="card"><h2>Reply from the team</h2><p class="reply-block">${escapeHtml(record.reply)}</p>${repliedWhen ? `<p class="reply-when">${escapeHtml(repliedWhen)}</p>` : ''}</section>`;
    }

    main = `<main class="card"><p class="eyebrow">Receipt</p><h1>We got your voice note</h1><p class="muted">${hasReply ? 'The team has responded.' : 'Bookmark this page — when our team responds, the reply will appear here.'} <span class="status-pill ${statusClass}">${statusText}</span></p><dl style="margin:0">${rows}</dl></main>${replyCard}`;
  }

  return renderShellHtml(title, main, baseUrl);
}

function renderAdminPage(record, slug, token, flash, errorMsg, baseUrl) {
  const rows = metadataRowsHtml(record);
  const existing = record.reply ? escapeHtml(record.reply) : '';
  const repliedAtRow = record.repliedAt
    ? `<p class="muted" style="margin:.4rem 0 0;font-size:.78rem">Last replied: ${escapeHtml(new Date(record.repliedAt).toLocaleString())}</p>`
    : '';
  const flashHtml = flash === 'sent'
    ? '<div class="flash ok">Reply saved. The visitor sees it on their receipt page.</div>'
    : errorMsg
      ? `<div class="flash err">${escapeHtml(errorMsg)}</div>`
      : '';
  const publicReceiptHref = `${baseUrl || ''}/r/${escapeHtml(slug)}`;
  // Empty action — POST goes to the current URL, so the proxy prefix stays.
  const main = `<main class="card"><p class="eyebrow">Admin · reply</p><h1>Reply to this voice note</h1>${flashHtml}<dl style="margin:0 0 1.1rem">${rows}</dl><form method="post" action=""><label for="reply" class="muted" style="display:block;margin-bottom:.4rem;font-size:.85rem">Type your reply — the visitor sees it on <a href="${publicReceiptHref}" target="_blank" rel="noopener" style="color:#6366f1">${escapeHtml('/r/' + slug)}</a>.</label><textarea name="reply" id="reply" class="reply-input" maxlength="5000" placeholder="Hi — thanks for your voice note...">${existing}</textarea>${repliedAtRow}<div style="margin-top:.9rem;display:flex;gap:.5rem;align-items:center"><button type="submit" class="btn-primary">${record.reply ? 'Update reply' : 'Send reply'}</button><span class="muted" style="margin:0;font-size:.78rem">This URL is private — don't share it.</span></div></form></main>`;
  return renderShellHtml('Reply · ' + slug, main, baseUrl);
}

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  const targets = getTargets();
  console.log(`voice-to-us backend listening on http://localhost:${port}`);
  if (targets.length === 0) {
    console.warn('WARNING: no Telegram targets configured — uploads will fail.');
  } else {
    console.log(
      `Telegram fan-out: ${targets.length} target(s) — ${targets.map((t) => `${t.label}:${t.chatId}`).join(', ')}`,
    );
  }
});
