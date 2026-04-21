import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { sendVoiceToTelegram } from './telegram.js';

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

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/widget.js', (_req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(widgetDir, 'voice-to-us.js'));
});

app.get('/widget-demo', (_req, res) => {
  res.sendFile(path.join(widgetDir, 'demo.html'));
});

app.post('/api/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Missing "audio" file field' });
    return;
  }

  try {
    const result = await sendVoiceToTelegram({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      chatId: process.env.TELEGRAM_CHAT_ID,
      botToken: process.env.TELEGRAM_BOT_TOKEN,
    });
    res.json({ ok: true, messageId: result.message_id });
  } catch (err) {
    console.error('[upload] failed:', err);
    const message = err instanceof Error ? err.message : 'Send failed';
    res.status(500).json({ error: message });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`voice-to-us backend listening on http://localhost:${port}`);
});
