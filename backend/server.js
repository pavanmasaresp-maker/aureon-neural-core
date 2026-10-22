const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { Readable } = require('stream');

const PORT = process.env.PORT || 3000;
const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const KEY = process.env.NEURAL_CORE_KEY;
const CHAT_MODEL = process.env.CHAT_MODEL || 'qwen2.5:7b';
const CODER_MODEL = process.env.CODER_MODEL || 'qwen2.5-coder:7b';
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  'You are Aureon Neural Core, a local offline AI assistant. Reply in the same language the user writes in (Hinglish is fine). For coding, give working code and short explanations.';

if (!KEY) {
  console.error('NEURAL_CORE_KEY is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  if (safeEqual(header, `Bearer ${KEY}`)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

const CODE_HINT = /```|\b(code|function|bug|error|api|class|script|sql|html|css|python|javascript|node|git|docker|regex|compile)\b/i;

function pickModel(model, messages) {
  if (model && model !== 'auto') return model;
  const last = [...(messages || [])].reverse().find((m) => m.role === 'user');
  return last && CODE_HINT.test(String(last.content)) ? CODER_MODEL : CHAT_MODEL;
}

async function forward(req, res, body) {
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  try {
    const r = await fetch(`${OLLAMA}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    res.status(r.status);
    res.set('Content-Type', r.headers.get('content-type') || 'application/json');
    if (!r.body) return res.end();
    Readable.fromWeb(r.body).pipe(res);
  } catch (e) {
    if (e.name === 'AbortError') return;
    res.status(502).json({ error: `Ollama is not reachable: ${e.message}` });
  }
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/models', auth, async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`);
    const data = await r.json();
    res.json({
      ollama: true,
      models: (data.models || []).map((m) => m.name),
      chat: CHAT_MODEL,
      coder: CODER_MODEL,
    });
  } catch {
    res.json({ ollama: false, models: [], chat: CHAT_MODEL, coder: CODER_MODEL });
  }
});

// Used by the web UI: adds the Aureon system prompt.
app.post('/api/chat', auth, (req, res) => {
  const { model, messages = [], stream = true } = req.body || {};
  const withSystem = messages.some((m) => m.role === 'system')
    ? messages
    : [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
  forward(req, res, { model: pickModel(model, messages), messages: withSystem, stream });
});

// OpenAI-style endpoint for Aureon and other clients (no system prompt added).
app.post('/v1/chat/completions', auth, (req, res) => {
  const body = req.body || {};
  forward(req, res, { ...body, model: pickModel(body.model, body.messages) });
});

app.listen(PORT, () => console.log(`Aureon Neural Core running on port ${PORT}`));
