import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

export async function sendVoiceToTelegram({ buffer, mimeType, chatId, botToken }) {
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not configured');

  const oggBuffer = await transcodeToOggOpus(buffer, mimeType);

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('voice', new Blob([oggBuffer], { type: 'audio/ogg' }), 'voice.ogg');

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
    method: 'POST',
    body: form,
  });
  const data = await resp.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description ?? 'unknown'}`);
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
