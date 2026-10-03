// Out-of-band alerts (WeCom group robot). Telegram is the thing being watched,
// so alerts must not go through Telegram.
//
// WECOM_WEBHOOK_URL — full https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…
// Unset = log only.

const lastSent = new Map(); // dedupe key -> epoch ms

export async function alert(text, { dedupeKey = null, minIntervalMs = 0 } = {}) {
  console.warn('[alert]', text.replace(/\n/g, ' | '));
  if (dedupeKey) {
    const prev = lastSent.get(dedupeKey) ?? 0;
    if (Date.now() - prev < minIntervalMs) return;
    lastSent.set(dedupeKey, Date.now());
  }
  const url = process.env.WECOM_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'markdown', markdown: { content: text.slice(0, 3800) } }),
    });
  } catch (err) {
    console.warn('[alert] WeCom send failed:', err?.message ?? err);
  }
}
