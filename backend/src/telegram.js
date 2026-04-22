import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

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

export async function sendVoiceToAllTargets({ buffer, mimeType }) {
  const targets = getTargets();
  if (targets.length === 0) {
    throw new Error(
      'No Telegram targets configured. Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in .env.',
    );
  }

  const oggBuffer = await transcodeToOggOpus(buffer, mimeType);

  const results = await Promise.allSettled(
    targets.map((t) => sendOggToOne(oggBuffer, t)),
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

async function sendOggToOne(oggBuffer, { token, chatId }) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('voice', new Blob([oggBuffer], { type: 'audio/ogg' }), 'voice.ogg');

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
