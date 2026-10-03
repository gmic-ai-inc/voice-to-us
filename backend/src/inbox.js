// Durable inbox for voice notes. Every recording is written to disk before any
// delivery attempt and removed only after Telegram accepted it — so a blocked
// bot, a dead chat id or a process restart can no longer lose a note silently.
//
// Layout: inbox/<id>.audio (raw upload) + inbox/<id>.json (metadata + state).
// state: 'parked' (waiting for the visitor's channel choice) | 'failed'.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const INBOX_DIR = path.resolve(__dirname, '../inbox');

const ID_RE = /^[A-Za-z0-9_-]{16}$/;

export function newId() {
  return randomBytes(12).toString('base64url'); // 16 chars
}

export function isValidId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

function files(id) {
  return {
    audio: path.join(INBOX_DIR, `${id}.audio`),
    meta: path.join(INBOX_DIR, `${id}.json`),
  };
}

export async function park(id, buffer, mimeType, meta) {
  await fs.mkdir(INBOX_DIR, { recursive: true });
  const f = files(id);
  await fs.writeFile(f.audio, buffer);
  await fs.writeFile(
    f.meta,
    JSON.stringify({ id, mimeType, meta, state: 'parked', createdAt: new Date().toISOString() }, null, 2),
  );
}

export async function load(id) {
  const f = files(id);
  const [buffer, raw] = await Promise.all([fs.readFile(f.audio), fs.readFile(f.meta, 'utf8')]);
  return { buffer, ...JSON.parse(raw) };
}

export async function markFailed(id, error) {
  const f = files(id);
  const rec = JSON.parse(await fs.readFile(f.meta, 'utf8'));
  rec.state = 'failed';
  rec.failedAt = new Date().toISOString();
  rec.error = String(error).slice(0, 500);
  await fs.writeFile(f.meta, JSON.stringify(rec, null, 2));
}

export async function remove(id) {
  const f = files(id);
  await Promise.all([fs.rm(f.audio, { force: true }), fs.rm(f.meta, { force: true })]);
}

// Notes still 'parked' when the process starts were never delivered (restart
// mid-wait). Returned so the server can deliver them on boot.
export async function listParked() {
  let names;
  try {
    names = await fs.readdir(INBOX_DIR);
  } catch {
    return [];
  }
  const out = [];
  for (const n of names) {
    if (!n.endsWith('.json')) continue;
    try {
      const rec = JSON.parse(await fs.readFile(path.join(INBOX_DIR, n), 'utf8'));
      if (rec.state === 'parked' && isValidId(rec.id)) out.push(rec.id);
    } catch {
      /* unreadable entry: leave it for a human */
    }
  }
  return out;
}
