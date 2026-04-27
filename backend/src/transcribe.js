const TRANSCRIBE_TIMEOUT_MS = 30_000;

export async function transcribeAudio(buffer, mimeType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
  const filename = filenameFor(mimeType);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), filename);
  form.append('model', model);
  form.append('response_format', 'text');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

  try {
    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`OpenAI ${resp.status}: ${detail.slice(0, 300)}`);
    }
    const text = (await resp.text()).trim();
    return text || null;
  } finally {
    clearTimeout(timer);
  }
}

function filenameFor(mimeType = '') {
  if (mimeType.includes('webm')) return 'audio.webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'audio.m4a';
  if (mimeType.includes('mpeg')) return 'audio.mp3';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('ogg')) return 'audio.ogg';
  return 'audio.webm';
}
