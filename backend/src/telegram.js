import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { transcribeAudio } from './transcribe.js';

const TELEGRAM_CAPTION_LIMIT = 1024;

export function getTargets() {
  const targets = [];
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    targets.push({
      label: 'primary',
      token: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
    });
  }
  for (let i = 2; i <= 20; i++) {
    const token = process.env[`TELEGRAM_BOT_TOKEN_${i}`];
    const chatId = process.env[`TELEGRAM_CHAT_ID_${i}`];
    if (token && chatId) {
      targets.push({ label: `#${i}`, token, chatId });
    }
  }
  return targets;
}

export async function sendVoiceToAllTargets({ buffer, mimeType, context = {} }) {
  const allTargets = getTargets();
  if (allTargets.length === 0) {
    throw new Error(
      'No Telegram targets configured. Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in .env.',
    );
  }

  // Skip Telegram + OpenAI entirely when the upload originates from a
  // localhost page — local widget testing must not page real recipients or
  // burn API credits. The /widget-demo path is exempt: that's the explicit
  // test surface, so its uploads always go through. Override globally with
  // ALLOW_LOCAL_SENDS=true.
  if (
    isLocalhostUrl(context.pageUrl) &&
    !isDemoPageUrl(context.pageUrl) &&
    !isTruthyEnv(process.env.ALLOW_LOCAL_SENDS)
  ) {
    const caption = buildCaption({ ...context, transcript: '[skipped: localhost test]' });
    console.log(
      `[telegram] LOCAL TEST — skipping Telegram + Whisper (set ALLOW_LOCAL_SENDS=true to enable).\n` +
        `  caption preview:\n${caption.replace(/^/gm, '    ')}`,
    );
    return {
      sent: [{ label: 'local-dry-run', chatId: 'n/a', messageId: 0 }],
      failed: [],
    };
  }

  // Demo-page uploads should go only to the primary recipient so the widget's
  // own demo doesn't keep paging every configured target.
  const isDemoPage = isDemoPageUrl(context.pageUrl);
  const targets = isDemoPage
    ? allTargets.filter((t) => t.label === 'primary')
    : allTargets;
  if (isDemoPage) {
    console.log(`[telegram] demo page upload — routing to primary only (${targets.length}/${allTargets.length})`);
  }

  // Run audio transcoding (for Telegram) and Whisper transcription in
  // parallel — independent work, both needed before sending.
  const [oggBuffer, transcript] = await Promise.all([
    transcodeToOggOpus(buffer, mimeType),
    transcribeAudio(buffer, mimeType).catch((err) => {
      console.warn('[transcribe] failed, sending without transcript:', err?.message ?? err);
      return null;
    }),
  ]);
  const caption = buildCaption({ ...context, transcript });

  const results = await Promise.allSettled(
    targets.map((t) => sendOggToOne(oggBuffer, t, caption)),
  );

  const sent = [];
  const failed = [];
  results.forEach((r, i) => {
    const t = targets[i];
    if (r.status === 'fulfilled') {
      sent.push({ label: t.label, chatId: t.chatId, messageId: r.value.message_id });
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      failed.push({ label: t.label, chatId: t.chatId, error: msg });
    }
  });

  if (failed.length > 0) {
    console.warn('[telegram] partial or total failure:', failed);
  }
  if (sent.length === 0) {
    const summary = failed.map((f) => `${f.label}: ${f.error}`).join(' | ');
    throw new Error(`All ${targets.length} Telegram target(s) failed. ${summary}`);
  }

  return { sent, failed };
}

async function sendOggToOne(oggBuffer, { token, chatId }, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('voice', new Blob([oggBuffer], { type: 'audio/ogg' }), 'voice.ogg');
  if (caption) {
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
  }

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
    method: 'POST',
    body: form,
  });
  const data = await resp.json();
  if (!data.ok) {
    throw new Error(`Telegram API: ${data.description ?? 'unknown error'}`);
  }
  return data.result;
}

function isDemoPageUrl(pageUrl) {
  if (!pageUrl) return false;
  try {
    const u = new URL(pageUrl);
    // Treat any page whose path ends with /widget-demo as the demo, regardless
    // of host — so local dev (localhost:4000/widget-demo) and prod
    // (gmic.ai/voice2us/widget-demo) are both filtered.
    return /\/widget-demo\/?$/.test(u.pathname);
  } catch (_) {
    return false;
  }
}

function isLocalhostUrl(pageUrl) {
  if (!pageUrl) return false;
  try {
    const u = new URL(pageUrl);
    return (
      u.hostname === 'localhost' ||
      u.hostname === '0.0.0.0' ||
      u.hostname === '[::1]' ||
      /^127\./.test(u.hostname) ||
      u.hostname.endsWith('.local')
    );
  } catch (_) {
    return false;
  }
}

function isTruthyEnv(v) {
  if (v == null) return false;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}

function buildCaption({ pageTitle, pageUrl, email, phone, channel, googleName, adminUrl, transcript } = {}) {
  const title = truncate(String(pageTitle ?? '').trim(), 200);
  const url = truncate(String(pageUrl ?? '').trim(), 500);
  const cleanEmail = truncate(String(email ?? '').trim(), 200);
  const cleanPhone = truncate(String(phone ?? '').trim(), 50);
  const cleanChannel = truncate(String(channel ?? '').trim().toLowerCase(), 30);
  const cleanName = truncate(String(googleName ?? '').trim(), 80);
  const cleanAdminUrl = String(adminUrl ?? '').trim();
  const cleanTranscript = String(transcript ?? '').trim();
  const ts =
    new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  // Reserve room for everything except the transcript, then truncate the
  // transcript to fit the Telegram 1024-char caption limit.
  const baseLines = [];
  baseLines.push(`<b>${escapeHtml(title || '(no page title)')}</b>`);
  if (url) baseLines.push(escapeHtml(url));
  if (cleanChannel) baseLines.push(`Reply via: <b>${escapeHtml(cleanChannel)}</b>`);
  if (cleanName) baseLines.push(`Name: ${escapeHtml(cleanName)}`);
  if (cleanEmail) baseLines.push(`Email: ${escapeHtml(cleanEmail)}`);
  if (cleanPhone) baseLines.push(`Phone: ${escapeHtml(cleanPhone)}`);
  if (cleanAdminUrl) baseLines.push(`Reply here: <a href="${escapeHtml(cleanAdminUrl)}">${escapeHtml(cleanAdminUrl)}</a>`);
  baseLines.push(ts);
  const baseLen = baseLines.join('\n').length;

  const lines = baseLines.slice(0, -1); // drop trailing timestamp; we re-append
  if (cleanTranscript) {
    const HEADER = '\nTranscript:\n';
    const SUFFIX = '\n' + ts;
    const budget = TELEGRAM_CAPTION_LIMIT - (baseLen + HEADER.length);
    const fitted = budget > 8 ? truncate(cleanTranscript, budget) : '';
    if (fitted) {
      lines.push(`Transcript:\n${escapeHtml(fitted)}`);
    }
  }
  lines.push(ts);
  return lines.join('\n');
}

function truncate(s, max) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function transcodeToOggOpus(input, mimeType) {
  const tmpDir = os.tmpdir();
  const inExt = extensionFor(mimeType);
  const inPath = path.join(tmpDir, `${randomUUID()}.${inExt}`);
  const outPath = path.join(tmpDir, `${randomUUID()}.ogg`);
  await fs.writeFile(inPath, input);

  try {
    await runFfmpeg([
      '-y',
      '-i', inPath,
      '-vn',
      '-ac', '1',
      '-ar', '48000',
      '-c:a', 'libopus',
      '-b:a', '48k',
      '-application', 'voip',
      outPath,
    ]);
    return await fs.readFile(outPath);
  } finally {
    await Promise.allSettled([fs.unlink(inPath), fs.unlink(outPath)]);
  }
}

function extensionFor(mimeType = '') {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg')) return 'mp3';
  return 'bin';
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegInstaller.path, args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(-500)}`));
    });
  });
}
