// File-based storage for voice-note "receipts". One JSON file per submission,
// keyed by slug. Good enough for low volume; swap for SQLite/Postgres later.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SUBMISSIONS_DIR = path.resolve(__dirname, '../submissions');

const SLUG_RE = /^[a-z2-9]{6,64}$/i;
const ADMIN_TOKEN_RE = /^[a-f0-9]{32}$/i;

export function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

export function isValidAdminToken(token) {
  return typeof token === 'string' && ADMIN_TOKEN_RE.test(token);
}

export function generateAdminToken() {
  return randomBytes(16).toString('hex');
}

export async function ensureSubmissionsDir() {
  await fs.mkdir(SUBMISSIONS_DIR, { recursive: true });
}

export async function saveSubmission(slug, record) {
  if (!isValidSlug(slug)) throw new Error(`invalid slug: ${slug}`);
  await ensureSubmissionsDir();
  const file = path.join(SUBMISSIONS_DIR, `${slug}.json`);
  await fs.writeFile(file, JSON.stringify(record, null, 2), 'utf8');
}

export async function loadSubmission(slug) {
  if (!isValidSlug(slug)) return null;
  const file = path.join(SUBMISSIONS_DIR, `${slug}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateSubmission(slug, patch) {
  const existing = await loadSubmission(slug);
  if (!existing) throw new Error(`submission not found: ${slug}`);
  const merged = { ...existing, ...patch };
  await saveSubmission(slug, merged);
  return merged;
}
