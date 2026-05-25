/**
 * AI proxy — forwards requests to AI providers using the user's own API key.
 *
 * PRIVACY CONTRACT:
 * - The API key is read from x-ai-key header and used only for this single request
 * - It is NEVER logged, stored, cached, or included in error responses
 * - Error messages are sanitized to remove any credential-like strings
 */

const ALLOWED_PROVIDERS = new Set(['openai', 'openrouter', 'anthropic', 'gemini', 'custom']);
const MAX_MESSAGES = 20;
const MAX_CONTENT_LEN = 128000;

// Simple in-memory rate limiter (per IP, resets every minute)
const _rateMap = new Map();
const RATE_WINDOW = 60_000;
const RATE_MAX = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = _rateMap.get(ip);
  if (!entry || now > entry.reset) {
    entry = { count: 1, reset: now + RATE_WINDOW };
  } else {
    entry.count++;
  }
  _rateMap.set(ip, entry);
  // Periodic cleanup
  if (_rateMap.size > 5000) {
    for (const [k, v] of _rateMap) if (now > v.reset) _rateMap.delete(k);
  }
  return entry.count <= RATE_MAX;
}

export async function handleAiProxy(req, res) {
  // Rate limit
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please wait a moment.' });
  }

  // Read key — NEVER log this value
  const apiKey = req.headers['x-ai-key'];
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 4) {
    return res.status(401).json({ ok: false, error: 'Missing or invalid API key.' });
  }
  const key = apiKey.trim();

  const { provider, model, messages, temperature, maxTokens, baseUrl } = req.body ?? {};

  if (!ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({ ok: false, error: `Unknown provider "${provider}". Allowed: ${[...ALLOWED_PROVIDERS].join(', ')}` });
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ ok: false, error: `messages must be a non-empty array (max ${MAX_MESSAGES}).` });
  }
  for (const m of messages) {
    if (!m || typeof m.role !== 'string' || typeof m.content !== 'string') {
      return res.status(400).json({ ok: false, error: 'Each message must have string role and content.' });
    }
    if (!['system', 'user', 'assistant'].includes(m.role)) {
      return res.status(400).json({ ok: false, error: `Invalid role "${m.role}".` });
    }
    if (m.content.length > MAX_CONTENT_LEN) {
      return res.status(400).json({ ok: false, error: `Message content too long (max ${MAX_CONTENT_LEN} chars).` });
    }
  }

  try {
    let content;
    switch (provider) {
      case 'openai':
      case 'openrouter':
      case 'custom':
        content = await callOpenAICompat({ provider, key, model, messages, temperature, maxTokens, baseUrl });
        break;
      case 'anthropic':
        content = await callAnthropic({ key, model, messages, temperature, maxTokens });
        break;
      case 'gemini':
        content = await callGemini({ key, model, messages, temperature, maxTokens });
        break;
    }
    return res.json({ ok: true, content: content ?? '' });
  } catch (err) {
    const { status, message } = sanitizeError(err);
    return res.status(status).json({ ok: false, error: message });
  }
}

async function callOpenAICompat({ provider, key, model, messages, temperature, maxTokens, baseUrl }) {
  let base;
  if (provider === 'openrouter') {
    base = 'https://openrouter.ai/api/v1';
  } else if (provider === 'custom' && baseUrl) {
    base = validateBaseUrl(baseUrl);
  } else {
    base = 'https://api.openai.com/v1';
  }

  const defaultModel = provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://poe2build.febsho.me';
    headers['X-Title'] = 'PoE2 Build Architect';
  }

  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: sanitizeStr(model) || defaultModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: clamp(temperature, 0, 2, 0.3),
      max_tokens: clamp(maxTokens, 64, 8192, 2048),
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw Object.assign(new Error(data?.error?.message || `Provider returned ${resp.status}`), { status: resp.status });
  }
  return data?.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic({ key, model, messages, temperature, maxTokens }) {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const userMsgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: sanitizeStr(model) || 'claude-haiku-4-5-20251001',
      max_tokens: clamp(maxTokens, 64, 8192, 2048),
      ...(system ? { system } : {}),
      messages: userMsgs,
      temperature: clamp(temperature, 0, 1, 0.3),
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw Object.assign(new Error(data?.error?.message || `Anthropic returned ${resp.status}`), { status: resp.status });
  }
  return data?.content?.[0]?.text ?? '';
}

async function callGemini({ key, model, messages, temperature, maxTokens }) {
  const modelId = sanitizeStr(model) || 'gemini-1.5-flash';
  if (!/^[\w.-]+$/.test(modelId)) throw new Error('Invalid model name.');

  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body = {
    contents,
    generationConfig: {
      temperature: clamp(temperature, 0, 2, 0.3),
      maxOutputTokens: clamp(maxTokens, 64, 8192, 2048),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  // For Gemini, key goes in query string — we must not log the URL
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    }
  );

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw Object.assign(new Error(data?.error?.message || `Gemini returned ${resp.status}`), { status: resp.status });
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function validateBaseUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Base URL must use http or https.');
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch (e) {
    throw new Error(e.message.startsWith('Base URL') ? e.message : 'Invalid base URL.');
  }
}

function clamp(v, min, max, fallback) {
  const n = Number(v);
  return isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

function sanitizeStr(s) {
  return typeof s === 'string' ? s.trim().slice(0, 200) : '';
}

function sanitizeError(err) {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599
    ? err.status
    : 500;
  const raw = String(err.message || 'Request failed').slice(0, 300);
  // Strip long alphanumeric tokens that could look like API keys
  const clean = raw.replace(/[A-Za-z0-9_-]{20,}/g, '[redacted]');
  return { status, message: clean };
}
