import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const widgetSource = readFileSync(join(__dirname, '..', 'widget', 'voice-to-us.js'), 'utf8');

test('floating Connect menu supports a configurable Slack link', () => {
  assert.match(widgetSource, /DEFAULT_SLACK_URL/);
  assert.match(widgetSource, /slack:\s*pickLink\(options\.linkSlack,\s*DEFAULT_SLACK_URL\)/);
  assert.match(widgetSource, /data-link-slack/);
  assert.match(widgetSource, /label:\s*'Slack'/);
});
