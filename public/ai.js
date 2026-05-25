'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const LS_SETTINGS  = 'poe2ai_settings';
const LS_LAST_BUILD = 'poe2ai_lastbuild';

const DEFAULT_SETTINGS = {
  provider:    'openai',
  apiKey:      '',
  model:       '',
  baseUrl:     '',
  temperature: 0.3,
  maxTokens:   4096,
};

const MODEL_PLACEHOLDERS = {
  openai:      'gpt-4o-mini',
  openrouter:  'openai/gpt-4o-mini',
  anthropic:   'claude-haiku-4-5-20251001',
  gemini:      'gemini-1.5-flash',
  custom:      'your-model-name',
};

const SYSTEM_PROMPT = `You are a Path of Exile 2 build assistant integrated into a build converter website.
Use only the provided context, user input, imported build data, and available local data.
Do not invent exact patch notes, passive nodes, item stats, or gem interactions.
If information is missing, clearly say it is missing.
Prefer practical, structured build advice.
When uncertain, mark the recommendation as uncertain.
Return structured JSON when requested.
Never claim that a build is fully verified unless the data proves it.
Focus on helping the user improve, analyze, or convert PoE2 builds.`;

const GENERATE_SCHEMA = `{
  "buildName": "string",
  "gameVersion": "string | null",
  "class": "string | null",
  "ascendancy": "string | null",
  "mainSkill": "string | null",
  "supportGems": ["string"],
  "secondarySkills": ["string"],
  "defensiveLayers": ["string"],
  "passiveTreePlan": ["string"],
  "gearPriorities": ["string"],
  "levelingPlan": ["string"],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "patchConcerns": ["string"],
  "validationWarnings": ["string"],
  "missingData": ["string"],
  "confidence": "verified | likely | uncertain | unsupported"
}`;

// ── State ──────────────────────────────────────────────────────────────────
let isLoading = false;
const $ = (id) => document.getElementById(id);

// ── Data status ─────────────────────────────────────────────────────────────

async function loadDataStatus() {
  const summaryEl = $('data-status-summary');
  const chipsEl   = $('data-status-chips');
  if (!summaryEl || !chipsEl) return;

  try {
    const resp = await fetch('/api/data/status');
    const data = await resp.json();
    if (!data.ok) throw new Error('Status fetch failed');

    const s = data.summary;
    summaryEl.textContent = s.message || '';

    chipsEl.innerHTML = Object.entries(data.categories).map(([key, cat]) => {
      const cls = cat.status === 'ok' || cat.status === 'bundled'
        ? 'data-chip ok'
        : cat.status === 'stale' ? 'data-chip stale' : 'data-chip missing';
      const title = cat.message || cat.status;
      return `<span class="${cls}" title="${esc(title)}">${esc(cat.label)}</span>`;
    }).join('');
  } catch {
    if (summaryEl) summaryEl.textContent = 'Could not load data status.';
  }
}

// ── Settings management ─────────────────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function collectSettings() {
  return {
    provider:    $('provider').value,
    apiKey:      $('api-key').value.trim(),
    model:       $('model').value.trim(),
    baseUrl:     $('base-url').value.trim(),
    temperature: parseFloat($('temperature').value) || 0.3,
    maxTokens:   parseInt($('max-tokens').value, 10) || 4096,
  };
}

function populateSettings(s) {
  $('provider').value    = s.provider    || 'openai';
  $('api-key').value     = s.apiKey      || '';
  $('model').value       = s.model       || '';
  $('base-url').value    = s.baseUrl     || '';
  $('temperature').value = s.temperature ?? 0.3;
  $('max-tokens').value  = s.maxTokens   ?? 4096;
  updateProviderUI(s.provider || 'openai');
  updateKeyBadge(s.apiKey, s.provider);
}

function saveSettings() {
  const s = collectSettings();
  try {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
    updateKeyBadge(s.apiKey, s.provider);
    showSettingsStatus('Settings saved.', 'ok');
  } catch {
    showSettingsStatus('Could not save — localStorage unavailable.', 'error');
  }
}

function clearKey() {
  const s = loadSettings();
  s.apiKey = '';
  try {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
    $('api-key').value = '';
    updateKeyBadge('', s.provider);
    showSettingsStatus('API key cleared.', 'ok');
  } catch {
    showSettingsStatus('Error clearing key.', 'error');
  }
}

function showSettingsStatus(msg, type) {
  const el = $('settings-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type || ''}`;
  setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 3500);
}

function updateKeyBadge(apiKey, provider) {
  const badge = $('key-status-badge');
  if (!badge) return;
  if (apiKey) {
    badge.textContent = `✓ ${provider || 'unknown'} key set`;
    badge.className = 'ai-key-status ok';
  } else {
    badge.textContent = 'No key configured';
    badge.className = 'ai-key-status none';
  }
}

// ── Provider UI ─────────────────────────────────────────────────────────────

function updateProviderUI(provider) {
  const baseUrlRow = $('base-url-row');
  const modelEl    = $('model');
  modelEl.placeholder = MODEL_PLACEHOLDERS[provider] || 'model-name';

  if (provider === 'custom') {
    baseUrlRow.classList.remove('hidden');
    $('base-url').placeholder = 'https://your-api.example.com/v1';
  } else if (provider === 'openrouter') {
    baseUrlRow.classList.remove('hidden');
    $('base-url').placeholder = 'https://openrouter.ai/api/v1 (auto-filled if blank)';
  } else {
    baseUrlRow.classList.add('hidden');
  }
}

function toggleKeyVisibility() {
  const input = $('api-key');
  const btn   = $('key-toggle');
  if (input.type === 'password') {
    input.type  = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type  = 'password';
    btn.textContent = 'Show';
  }
}

// ── Test connection ─────────────────────────────────────────────────────────

async function testConnection() {
  const s = collectSettings();
  if (!s.apiKey) { showSettingsStatus('Enter an API key first.', 'error'); return; }

  const btn = $('test-btn');
  btn.disabled = true;
  showSettingsStatus('Testing…', '');

  try {
    const content = await sendToProxy(
      [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user',   content: 'Reply with exactly the text: Connection OK' },
      ],
      s
    );
    const preview = (content || '').slice(0, 80);
    if (content && content.includes('Connection')) {
      showSettingsStatus('Connection OK.', 'ok');
    } else {
      showSettingsStatus(`Connected. Response: "${preview}"`, 'ok');
    }
  } catch (err) {
    showSettingsStatus(`Failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ── Core AI request ─────────────────────────────────────────────────────────

async function sendToProxy(messages, settingsOverride) {
  const s = settingsOverride || loadSettings();
  if (!s.apiKey) throw new Error('No API key configured. Add one in Settings above.');

  const resp = await fetch('/api/ai/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ai-key': s.apiKey,
    },
    body: JSON.stringify({
      provider:    s.provider,
      model:       s.model    || undefined,
      baseUrl:     s.baseUrl  || undefined,
      messages,
      temperature: s.temperature,
      maxTokens:   s.maxTokens,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.ok) throw new Error(data.error || `Request failed (${resp.status})`);
  return data.content;
}

// ── Mode switching ──────────────────────────────────────────────────────────

function switchMode(mode) {
  document.querySelectorAll('.ai-mode-tab').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.mode === mode)
  );
  document.querySelectorAll('.ai-mode-panel').forEach((panel) =>
    panel.classList.toggle('active', panel.id === `ai-panel-${mode}`)
  );
}

// ── Last converted build ────────────────────────────────────────────────────

function loadLastBuild() {
  try {
    const raw = localStorage.getItem(LS_LAST_BUILD);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function checkLastBuild() {
  const data = loadLastBuild();
  const btn  = $('use-last-build');
  if (!btn) return;
  if (data && data.build) {
    btn.disabled = false;
    const name = data.build.name || 'unnamed build';
    btn.textContent = `Use last converted build (${name})`;
  } else {
    btn.disabled = true;
    btn.textContent = 'No converted build yet';
  }
}

function useLastBuild() {
  const data = loadLastBuild();
  if (!data || !data.build) return;

  const b = data.build;
  const r = data.report || {};

  // Build a readable summary for the AI
  const lines = [];
  if (b.name)       lines.push(`Build Name: ${b.name}`);
  if (b.ascendancy) lines.push(`Ascendancy: ${b.ascendancy}`);
  if (data.source?.kind) lines.push(`Source: ${data.source.kind}`);
  if (b.description) lines.push(`Description: ${b.description}`);

  if (b.skills?.length) {
    lines.push('\nSkill Groups:');
    for (const sk of b.skills) {
      const name = sk.id || sk.gem || 'Unknown';
      const supports = (sk.support_skills || []).map((s) => s.id || s.gem).filter(Boolean);
      lines.push(`  - ${name}${supports.length ? ` (supports: ${supports.join(', ')})` : ''}`);
    }
  }

  if (b.passives?.length) {
    const nodeIds = b.passives.map((p) => (typeof p === 'string' ? p : p?.id)).filter(Boolean);
    lines.push(`\nPassives (${nodeIds.length} nodes):`);
    lines.push(`  - ${nodeIds.join(', ')}`);
  }

  if (b.items?.length) {
    lines.push('\nItems:');
    for (const it of b.items) {
      const displayName = it.unique_name || it.inventory_id || 'Unnamed Item';
      const detail = it.additional_text ? ` (${it.additional_text.split('\n')[0]})` : '';
      lines.push(`  - ${displayName}${detail}`);
    }
  }

  if (r.converted?.length) lines.push(`\nConverter: ${r.converted.length} converted, ${r.guessed?.length || 0} guessed, ${r.unsupported?.length || 0} unsupported`);
  if (r.warnings?.length) lines.push(`Warnings: ${r.warnings.join('; ')}`);

  $('analyze-input').value = lines.join('\n');
}

// ── Analyze ─────────────────────────────────────────────────────────────────

async function analyzeMain() {
  if (isLoading) return;

  const input      = ($('analyze-input').value || '').trim();
  const patchNotes = ($('patch-notes').value   || '').trim();

  if (!input) {
    setStatus('analyze', 'Paste build data first.', 'error');
    return;
  }

  const s = loadSettings();
  if (!s.apiKey) {
    setStatus('analyze', 'Add your API key in Settings above.', 'error');
    $('ai-settings-details').open = true;
    return;
  }

  setLoading(true);
  setStatus('analyze', 'Analyzing…', '');

  const patchSection = patchNotes
    ? `\nPatch notes provided by user:\n${patchNotes.slice(0, 8000)}`
    : '';

  const buildText = `${input.slice(0, 12000)}${patchSection}`;
  const query = `Provide a structured analysis with sections: Build Summary, Strengths, Weaknesses / Concerns, Suggested Improvements, Patch Impact, Confidence Level. Be honest about missing data.`;

  try {
    const resp = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-key': s.apiKey },
      body: JSON.stringify({
        provider: s.provider, model: s.model || undefined, baseUrl: s.baseUrl || undefined,
        temperature: s.temperature, maxTokens: s.maxTokens,
        buildText, query,
      }),
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || `Request failed (${resp.status})`);
    renderAnalyzeResult(data.content, data);
    setStatus('analyze', '', '');
  } catch (err) {
    setStatus('analyze', err.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ── Generate ─────────────────────────────────────────────────────────────────

async function generateMain() {
  if (isLoading) return;

  const description = ($('generate-input').value || '').trim();

  if (!description) {
    setStatus('generate', 'Describe the build you want first.', 'error');
    return;
  }

  const s = loadSettings();
  if (!s.apiKey) {
    setStatus('generate', 'Add your API key in Settings above.', 'error');
    $('ai-settings-details').open = true;
    return;
  }

  setLoading(true);
  setStatus('generate', 'Generating…', '');
  $('pob-btn')?.classList.add('hidden');
  $('open-planner-btn')?.classList.add('hidden');

  try {
    const resp = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-key': s.apiKey },
      body: JSON.stringify({
        provider: s.provider, model: s.model || undefined, baseUrl: s.baseUrl || undefined,
        temperature: s.temperature, maxTokens: s.maxTokens,
        query: description,
      }),
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || `Request failed (${resp.status})`);
    renderGenerateResult(data.content, data);
    setStatus('generate', '', '');
  } catch (err) {
    setStatus('generate', err.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ── Result rendering ─────────────────────────────────────────────────────────

function renderAnalyzeResult(content, meta) {
  const panel     = $('ai-results');
  const container = $('ai-result-content');
  const title     = $('ai-result-title');

  title.textContent = 'Build Analysis';
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const badge = meta ? renderConfidenceBadge(meta) : '';
  container.innerHTML = `${badge}<div class="ai-result-text">${formatAiResponse(content)}</div>`;

  $('copy-result-btn').onclick = () => copyText(content, $('copy-result-btn'));
  $('copy-json-btn').classList.add('hidden');
  $('pob-btn').classList.add('hidden');
  $('tree-btn')?.classList.add('hidden');
  $('tree-panel')?.classList.add('hidden');
  $('open-planner-btn')?.classList.add('hidden');
}

function renderConfidenceBadge(meta) {
  if (!meta) return '';
  const conf    = meta.confidence || 'uncertain';
  const sources = (meta.sources || []).join(', ') || 'none';
  const cls     = { verified: 'green', likely: '', uncertain: 'amber', unsupported: 'red' }[conf] || 'amber';
  const trunc   = meta.contextTruncated ? ' <span class="muted-label">(context truncated)</span>' : '';
  return `<div class="ai-confidence-bar">
    <span class="tag ${cls}">Confidence: ${esc(conf)}</span>
    <span class="muted-label">Data sources: ${esc(sources)}${trunc}</span>
  </div>`;
}

function stripComments(str) {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (!inString) {
      if (char === '/' && str[i + 1] === '/') {
        while (i < str.length && str[i] !== '\n') {
          i++;
        }
        result += '\n';
        continue;
      }
      if (char === '/' && str[i + 1] === '*') {
        i += 2;
        while (i < str.length && !(str[i] === '*' && str[i + 1] === '/')) {
          i++;
        }
        i++;
        continue;
      }
    }
    result += char;
  }
  return result;
}

function repairAndParseJson(str) {
  let inString = false;
  let escaped = false;
  let processed = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      processed += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      processed += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      processed += char;
      continue;
    }
    if (inString && (char === '\n' || char === '\r')) {
      processed += '\\n';
    } else {
      processed += char;
    }
  }

  return parseTruncatedJsonState(processed);
}

function parseTruncatedJsonState(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === '{' || char === '}' || char === '[' || char === ']' || char === ':' || char === ',') {
      tokens.push({ type: char, value: char, raw: char });
      i++;
      continue;
    }
    if (char === '"') {
      const start = i;
      i++;
      let closed = false;
      let escaped = false;
      let val = '';
      while (i < str.length) {
        const c = str[i];
        if (escaped) {
          val += c;
          escaped = false;
          i++;
          continue;
        }
        if (c === '\\') {
          val += c;
          escaped = true;
          i++;
          continue;
        }
        if (c === '"') {
          closed = true;
          i++;
          break;
        }
        val += c;
        i++;
      }
      
      if (!closed) {
        let rawStr = str.slice(start, i);
        if (rawStr.endsWith('\\')) {
          rawStr = rawStr.slice(0, -1);
          val = val.slice(0, -1);
        }
        rawStr += '"';
        tokens.push({ type: 'string', value: val, closed: true, raw: rawStr });
      } else {
        tokens.push({ type: 'string', value: val, closed: true, raw: str.slice(start, i) });
      }
      continue;
    }

    const start = i;
    while (i < str.length && /[a-zA-Z0-9.+-]/.test(str[i])) {
      i++;
    }
    const val = str.slice(start, i);
    tokens.push({ type: 'literal', value: val, raw: val });
  }

  const stack = [];
  const keptTokens = [];
  let ok = true;

  const getExpected = () => {
    if (stack.length === 0) return 'ROOT';
    return stack[stack.length - 1].state;
  };

  const numberRegex = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
  const isValidLiteral = (val) => {
    return val === 'true' || val === 'false' || val === 'null' || numberRegex.test(val);
  };

  for (const tok of tokens) {
    if (!ok) break;

    const expected = getExpected();

    if (expected === 'ROOT') {
      if (tok.type === '{') {
        stack.push({ type: 'object', state: 'KEY' });
        keptTokens.push(tok);
      } else if (tok.type === '[') {
        stack.push({ type: 'array', state: 'VALUE' });
        keptTokens.push(tok);
      } else {
        ok = false;
      }
    } else if (expected === 'KEY') {
      if (tok.type === 'string' && tok.closed) {
        stack[stack.length - 1].state = 'COLON';
        keptTokens.push(tok);
      } else if (tok.type === '}') {
        stack.pop();
        if (stack.length > 0) {
          stack[stack.length - 1].state = 'COMMA';
        }
        keptTokens.push(tok);
      } else {
        ok = false;
      }
    } else if (expected === 'COLON') {
      if (tok.type === ':') {
        stack[stack.length - 1].state = 'VALUE';
        keptTokens.push(tok);
      } else {
        ok = false;
      }
    } else if (expected === 'VALUE') {
      if (tok.type === '{') {
        stack.push({ type: 'object', state: 'KEY' });
        keptTokens.push(tok);
      } else if (tok.type === '[') {
        stack.push({ type: 'array', state: 'VALUE' });
        keptTokens.push(tok);
      } else if (tok.type === 'string' && tok.closed) {
        stack[stack.length - 1].state = 'COMMA';
        keptTokens.push(tok);
      } else if (tok.type === 'literal' && isValidLiteral(tok.value)) {
        stack[stack.length - 1].state = 'COMMA';
        keptTokens.push(tok);
      } else if (tok.type === ']' && stack[stack.length - 1].type === 'array') {
        stack.pop();
        if (stack.length > 0) {
          stack[stack.length - 1].state = 'COMMA';
        }
        keptTokens.push(tok);
      } else {
        ok = false;
      }
    } else if (expected === 'COMMA') {
      if (tok.type === ',') {
        if (stack[stack.length - 1].type === 'object') {
          stack[stack.length - 1].state = 'KEY';
        } else {
          stack[stack.length - 1].state = 'VALUE';
        }
        keptTokens.push(tok);
      } else if (tok.type === '}' && stack[stack.length - 1].type === 'object') {
        stack.pop();
        if (stack.length > 0) {
          stack[stack.length - 1].state = 'COMMA';
        }
        keptTokens.push(tok);
      } else if (tok.type === ']' && stack[stack.length - 1].type === 'array') {
        stack.pop();
        if (stack.length > 0) {
          stack[stack.length - 1].state = 'COMMA';
        }
        keptTokens.push(tok);
      } else {
        ok = false;
      }
    }
  }

  while (stack.length > 0) {
    const container = stack[stack.length - 1];
    if (container.type === 'object') {
      if (container.state === 'COLON' || container.state === 'VALUE') {
        while (keptTokens.length > 0) {
          const t = keptTokens.pop();
          if (t.type === 'string') {
            if (keptTokens.length > 0 && keptTokens[keptTokens.length - 1].type === ',') {
              keptTokens.pop();
            }
            break;
          }
        }
        container.state = 'COMMA';
      }
      
      if (keptTokens.length > 0 && keptTokens[keptTokens.length - 1].type === ',') {
        keptTokens.pop();
      }
      
      keptTokens.push({ type: '}', value: '}', raw: '}' });
      stack.pop();
      if (stack.length > 0) {
        stack[stack.length - 1].state = 'COMMA';
      }
    } else if (container.type === 'array') {
      if (keptTokens.length > 0 && keptTokens[keptTokens.length - 1].type === ',') {
        keptTokens.pop();
      }
      keptTokens.push({ type: ']', value: ']', raw: ']' });
      stack.pop();
      if (stack.length > 0) {
        stack[stack.length - 1].state = 'COMMA';
      }
    }
  }

  for (let j = 0; j < keptTokens.length - 1; j++) {
    if (keptTokens[j].type === ',' && (keptTokens[j + 1].type === '}' || keptTokens[j + 1].type === ']')) {
      keptTokens.splice(j, 1);
      j--;
    }
  }

  let reconstructed = '';
  for (const t of keptTokens) {
    reconstructed += t.raw;
  }

  return JSON.parse(reconstructed);
}

function parseRobustJson(text) {
  if (typeof text !== 'string') return null;
  let cleaned = text.trim();

  cleaned = stripComments(cleaned);

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {}

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  }

  if (startIdx !== -1) {
    let candidate = cleaned.slice(startIdx);
    if (endIdx !== -1 && endIdx > startIdx) {
      candidate = cleaned.slice(startIdx, endIdx + 1);
    }

    try {
      return JSON.parse(candidate);
    } catch {}

    try {
      return repairAndParseJson(candidate);
    } catch {}
  }

  return null;
}

function renderGenerateResult(rawContent, meta) {
  const panel     = $('ai-results');
  const container = $('ai-result-content');
  const title     = $('ai-result-title');

  title.textContent = 'Generated Build';
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Try to extract JSON from the response
  const parsed = parseRobustJson(rawContent);

  if (parsed) {
    // Self-healing / backwards-compatible schema mapping
    if (parsed.keyGems && (!parsed.supportGems || !parsed.supportGems.length)) {
      parsed.supportGems = parsed.keyGems;
    }
    if (parsed.keyPassives && (!parsed.passiveTreePlan || !parsed.passiveTreePlan.length)) {
      parsed.passiveTreePlan = parsed.keyPassives;
    }
    if (parsed.playstyle && (!parsed.strengths || !parsed.strengths.length)) {
      parsed.strengths = [parsed.playstyle];
    }
    if (parsed.notes && (!parsed.levelingPlan || !parsed.levelingPlan.length)) {
      parsed.levelingPlan = [parsed.notes];
    }
    if (!parsed.buildName) {
      parsed.buildName = `${parsed.ascendancy || parsed.class || 'PoE2'} Build`;
    }
    if (!parsed.mainSkill && parsed.supportGems && parsed.supportGems.length) {
      parsed.mainSkill = parsed.supportGems[0];
    }

    const badge = meta ? renderConfidenceBadge(meta) : '';
    const warningHtml = `<div class="ai-notice warn" style="margin-bottom:14px; font-size:12.5px;">
      ⚠️ PoB export is experimental. Some fields may import as notes until exact PoB2 schema support is completed.
    </div>`;
    container.innerHTML = badge + warningHtml + renderGenerateCard(parsed);
    
    const jsonStr = JSON.stringify(parsed, null, 2);
    const jsonBtn = $('copy-json-btn');
    jsonBtn.classList.remove('hidden');
    jsonBtn.onclick = () => copyText(jsonStr, jsonBtn);

    const pobBtn = $('pob-btn');
    pobBtn.classList.remove('hidden');
    pobBtn.onclick = () => openPobModal(parsed);

    const treeBtn = $('tree-btn');
    if (treeBtn) {
      treeBtn.classList.remove('hidden');
      treeBtn.textContent = 'Skill Tree';
      treeBtn.onclick = () => openTreePanel(parsed);
    }

    const openPlannerBtn = $('open-planner-btn');
    if (openPlannerBtn) {
      openPlannerBtn.classList.remove('hidden');
      openPlannerBtn.onclick = () => {
        // Construct standard PoE2 planner build object
        const planPayload = {
          build: {
            name: parsed.buildName || `${parsed.ascendancy || parsed.class || 'AI'} Build`,
            class: parsed.class || '',
            ascendancy: parsed.ascendancy || '',
            skills: parsed.skills || [],
            passives: parsed.passives || [],
            items: parsed.items || []
          },
          report: {
            converted: [
              ...(parsed.passives || []).map(p => `passive node ${p}`),
              ...(parsed.skills || []).map(s => `skill ${s.id}`),
              ...(parsed.items || []).map(i => `item ${i.unique_name || i.inventory_id}`)
            ],
            guessed: [],
            unsupported: [],
            warnings: parsed.validationWarnings || []
          },
          source: { kind: 'AI Architect' }
        };
        localStorage.setItem('poe2ai_lastbuild', JSON.stringify(planPayload));
        localStorage.setItem('poe2ai_load_generated', 'true');
        window.location.href = '/';
      };
    }
  } else {
    container.innerHTML = `
      <div class="ai-notice warn">Could not parse JSON from response — showing raw output.</div>
      <div class="ai-result-text">${formatAiResponse(rawContent)}</div>
    `;
    $('copy-json-btn').classList.add('hidden');
    $('pob-btn').classList.add('hidden');
    $('tree-btn')?.classList.add('hidden');
    $('tree-panel')?.classList.add('hidden');
    $('open-planner-btn')?.classList.add('hidden');
  }

  $('copy-result-btn').onclick = () => copyText(rawContent, $('copy-result-btn'));
}

function renderGenerateCard(b) {
  const confClass = { verified: 'green', likely: '', uncertain: 'amber', unsupported: 'red' }[b.confidence] || 'amber';

  const list = (arr) =>
    Array.isArray(arr) && arr.length
      ? `<ul class="ai-list">${arr.map((i) => `<li>${esc(String(i))}</li>`).join('')}</ul>`
      : `<p class="ai-empty">None listed.</p>`;

  const card = (label, content) =>
    `<div class="ai-card"><div class="ai-card-title">${label}</div>${content}</div>`;

  const hasWarnings = (b.validationWarnings?.length || b.missingData?.length || b.patchConcerns?.length);

  return `
    <div class="ai-build-header">
      <h2 class="ai-build-name">${esc(b.buildName || 'Generated Build')}</h2>
      <div class="ai-build-meta">
        ${b.class       ? `<span class="tag">${esc(b.class)}</span>`       : ''}
        ${b.ascendancy  ? `<span class="tag amber">${esc(b.ascendancy)}</span>` : ''}
        ${b.mainSkill   ? `<span class="tag green">${esc(b.mainSkill)}</span>`  : ''}
        ${b.gameVersion ? `<span class="tag">${esc(b.gameVersion)}</span>` : ''}
        <span class="tag ${confClass}">Confidence: ${esc(b.confidence || 'unknown')}</span>
      </div>
    </div>

    <div class="ai-cards-grid">
      ${card('Support Gems',    list(b.supportGems))}
      ${card('Secondary Skills', list(b.secondarySkills))}
      ${card('Defensive Layers', list(b.defensiveLayers))}
    </div>
    <div class="ai-cards-grid">
      ${card('Passive Tree Plan', list(b.passiveTreePlan))}
      ${card('Gear Priorities',   list(b.gearPriorities))}
      ${card('Leveling Plan',     list(b.levelingPlan))}
    </div>
    <div class="ai-cards-grid">
      ${card('Strengths',   list(b.strengths))}
      ${card('Weaknesses',  list(b.weaknesses))}
    </div>
    ${hasWarnings ? `
    <div class="ai-cards-grid">
      ${b.patchConcerns?.length      ? card('Patch Concerns',       list(b.patchConcerns))      : ''}
      ${b.validationWarnings?.length ? card('Validation Warnings',  list(b.validationWarnings)) : ''}
      ${b.missingData?.length        ? card('Missing / Unverified', list(b.missingData))         : ''}
    </div>` : ''}
  `;
}

// ── Markdown-like formatter ──────────────────────────────────────────────────

function formatAiResponse(text) {
  const lines = esc(text).split('\n');
  let html   = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const raw     = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      if (inList) { html += '</ul>'; inList = false; }
      if (html.length > 0) html += '<div class="ai-para-gap"></div>';
      continue;
    }

    // Heading: ### or ** on its own line or "1. **Heading**"
    const headingMatch =
      trimmed.match(/^#{1,3}\s+(.+)$/) ||
      trimmed.match(/^\*\*([^*]+)\*\*:?\s*$/) ||
      trimmed.match(/^\d+\.\s+\*\*([^*]+)\*\*:?\s*$/);

    if (headingMatch) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3 class="ai-section-title">${applyInline(headingMatch[1])}</h3>`;
      continue;
    }

    // List item: -, •, *, or numbered
    if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+\.\s/)) {
      if (!inList) { html += '<ul class="ai-list">'; inList = true; }
      const content = trimmed.replace(/^[-•*\d.]+\s+/, '');
      html += `<li>${applyInline(content)}</li>`;
      continue;
    }

    // Regular paragraph line
    if (inList) { html += '</ul>'; inList = false; }
    html += `<p>${applyInline(trimmed)}</p>`;
  }

  if (inList) html += '</ul>';
  return html;
}

function applyInline(text) {
  // text is already HTML-escaped; just apply bold/italic patterns
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// ── Utilities ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setStatus(mode, msg, type) {
  const el = $(`${mode}-status`);
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type || ''}`;
}

function setLoading(loading) {
  isLoading = loading;
  [$('analyze-btn'), $('generate-btn'), $('test-btn')].forEach((btn) => {
    if (btn) btn.disabled = loading;
  });
  $('ai-spinner')?.classList.toggle('hidden', !loading);
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch {
    btn.textContent = 'Copy failed';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  }
}

// ── PoB Export Actions ───────────────────────────────────────────────────────

let currentPobCode = '';
let currentPobXml = '';

/**
 * Client-side fallback PoB generator using modern browser CompressionStream.
 * Produces an exact equivalent base64url-encoded PoB code.
 */
async function clientSidePobExport(build) {
  if (!build) {
    throw new Error('Cannot generate PoB code: missing build data.');
  }
  if (!build.mainSkill || build.mainSkill.trim() === '') {
    throw new Error('Cannot generate PoB code: missing main skill.');
  }

  // 1. Build beautiful Notes text block for non-mappable data
  const notesLines = [];
  notesLines.push('Partial PoB export (Client-Side Fallback) — passive tree, exact item stats, and config are not fully available yet.\n');
  notesLines.push(`=== Build Name ===\n${build.buildName || 'Unnamed AI Build'}\n`);
  notesLines.push(`=== Class ===\n${build.class || 'None Specified'}\n`);
  notesLines.push(`=== Ascendancy ===\n${build.ascendancy || 'None Specified'}\n`);
  notesLines.push(`=== Main Skill ===\n${build.mainSkill}\n`);

  if (build.supportGems && build.supportGems.length > 0) {
    notesLines.push(`=== Support Gems ===\n${build.supportGems.join('\n')}\n`);
  }
  if (build.secondarySkills && build.secondarySkills.length > 0) {
    notesLines.push(`=== Secondary Skills ===\n${build.secondarySkills.join('\n')}\n`);
  }
  if (build.defensiveLayers && build.defensiveLayers.length > 0) {
    notesLines.push(`=== Defensive Layers ===\n${build.defensiveLayers.join('\n')}\n`);
  }
  if (build.passiveTreePlan && build.passiveTreePlan.length > 0) {
    notesLines.push(`=== Passive Tree Direction ===\n${build.passiveTreePlan.join('\n')}\n`);
  }
  if (build.gearPriorities && build.gearPriorities.length > 0) {
    notesLines.push(`=== Gear Priorities ===\n${build.gearPriorities.join('\n')}\n`);
  }
  if (build.levelingPlan && build.levelingPlan.length > 0) {
    notesLines.push(`=== Leveling Notes ===\n${build.levelingPlan.join('\n')}\n`);
  }

  const warnings = [];
  if (!build.class || build.class.trim() === '') {
    warnings.push('PoB export may be incomplete: missing class.');
  }
  if (build.validationWarnings && build.validationWarnings.length > 0) {
    warnings.push(...build.validationWarnings);
  }
  if (warnings.length > 0) {
    notesLines.push(`=== Validation Warnings ===\n${warnings.join('\n')}\n`);
  }

  const notesText = notesLines.join('\n');

  // Helper to escape XML special entities safely
  const escXml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // 2. Generate compliant passive node hashes
  const nodeHashes = [];
  if (build.passives && build.passives.length > 0) {
    for (const id of build.passives) {
      const cleanId = typeof id === 'string' ? id : id?.id;
      if (cleanId) {
        const parsedHash = parseInt(cleanId, 10);
        if (!isNaN(parsedHash) && String(parsedHash) === cleanId) {
          nodeHashes.push(parsedHash);
        }
      }
    }
  }

  // 3. Generate compliant PoB Skills section
  let skillsXml = '';
  if (build.skills && build.skills.length > 0) {
    const skillGroups = [];
    build.skills.forEach((sk) => {
      const activeGemName = escXml(sk.id || sk.gem || 'Main Skill');
      const activeGem = `        <Gem enable="true" level="20" nameSpec="${activeGemName}" skillId="" quality="0"/>`;
      const supportGems = (sk.support_skills || [])
        .map((sup) => `        <Gem enable="true" level="20" nameSpec="${escXml(sup.id || sup.gem)}" skillId="" quality="0" support="true"/>`)
        .join('\n');
      
      skillGroups.push(`      <Skill enabled="true" mainActiveSkill="1">\n${activeGem}\n${supportGems}\n      </Skill>`);
    });
    skillsXml = `<Skills activeSkillSet="1">
    <SkillSet id="1" title="Default">
${skillGroups.join('\n')}
    </SkillSet>
  </Skills>`;
  } else {
    // Fallback to simple fields
    const mainSkillGem = `        <Gem enable="true" level="20" nameSpec="${escXml(build.mainSkill)}" skillId="" quality="0"/>`;
    const supportGemsXml = (build.supportGems || [])
      .map((gem) => `        <Gem enable="true" level="20" nameSpec="${escXml(gem)}" skillId="" quality="0" support="true"/>`)
      .join('\n');

    const secondarySkillsXml = (build.secondarySkills || [])
      .map((skill) => `      <Skill enabled="true">\n        <Gem enable="true" level="20" nameSpec="${escXml(skill)}" skillId="" quality="0"/>\n      </Skill>`)
      .join('\n');

    skillsXml = `<Skills activeSkillSet="1">
    <SkillSet id="1" title="Default">
      <Skill enabled="true" mainActiveSkill="1">
${mainSkillGem}
${supportGemsXml}
      </Skill>
${secondarySkillsXml}
    </SkillSet>
  </Skills>`;
  }

  // 4. Generate compliant PoB Items section
  let itemsSectionXml = '';
  if (build.items && build.items.length > 0) {
    const slots = [];
    const items = [];
    build.items.forEach((it, idx) => {
      const itemId = idx + 1;
      const slotName = it.inventory_id || '';
      if (slotName) {
        slots.push(`      <Slot name="${escXml(slotName)}" itemId="${itemId}"/>`);
      }
      
      let itemText = it.additional_text || '';
      if (!itemText) {
        const rarity = it.rarity || 'Unique';
        const name = it.unique_name || 'Item';
        itemText = `Rarity: ${rarity.toUpperCase()}\n${name}\n`;
      }
      
      items.push(`    <Item id="${itemId}">\n      ${escXml(itemText).trim()}\n    </Item>`);
    });
    
    itemsSectionXml = `\n  <Items activeItemSet="1">
    <ItemSet id="1" title="Default">
${slots.join('\n')}
    </ItemSet>
${items.join('\n')}
  </Items>`;
  }

  const CLASS_NAME_TO_ID = {
    'Warrior': 1,
    'Ranger': 2,
    'Witch': 3,
    'Mercenary': 4,
    'Monk': 5,
    'Sorceress': 6,
    'Druid': 7,
    'Huntress': 8,
    'Templar': 9,
    'Duelist': 10,
    'Shadow': 11,
    'Marauder': 12,
  };

  const ASCENDANCY_TO_ID = {
    'Oracle': { classId: 7, ascendId: 1 },
    'Shaman': { classId: 7, ascendId: 2 },
    'Amazon': { classId: 8, ascendId: 1 },
    'Ritualist': { classId: 8, ascendId: 3 },
    'Tactician': { classId: 4, ascendId: 1 },
    'Witchhunter': { classId: 4, ascendId: 2 },
    'Gemling Legionnaire': { classId: 4, ascendId: 3 },
    'Invoker': { classId: 5, ascendId: 2 },
    'Acolyte of Chayula': { classId: 5, ascendId: 3 },
    'Deadeye': { classId: 2, ascendId: 1 },
    'Pathfinder': { classId: 2, ascendId: 3 },
    'Stormweaver': { classId: 6, ascendId: 1 },
    'Chronomancer': { classId: 6, ascendId: 2 },
    'Disciple of Varashta': { classId: 6, ascendId: 3 },
    'Titan': { classId: 1, ascendId: 1 },
    'Warbringer': { classId: 1, ascendId: 2 },
    'Smith of Kitava': { classId: 1, ascendId: 3 },
    'Infernalist': { classId: 3, ascendId: 1 },
    'Blood Mage': { classId: 3, ascendId: 2 },
    'Lich': { classId: 3, ascendId: 3 },
    'Abyssal Lich': { classId: 3, ascendId: 6 },
  };

  const classNameEsc = escXml(build.class || '');
  const ascendNameEsc = escXml(build.ascendancy || '');

  let classId = 0;
  let ascendClassId = 0;

  const ascName = build.ascendancy || '';
  const className = build.class || '';

  if (ascName && ASCENDANCY_TO_ID[ascName]) {
    classId = ASCENDANCY_TO_ID[ascName].classId;
    ascendClassId = ASCENDANCY_TO_ID[ascName].ascendId;
  } else if (className && CLASS_NAME_TO_ID[className]) {
    classId = CLASS_NAME_TO_ID[className];
  }

  const treeVer = build.treeVersion || build.tree_version || '0_4';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="1" className="${classNameEsc}" ascendClassName="${ascendNameEsc}" mainSocketGroup="1" viewMode="NOTES" targetVersion="3_0">
  </Build>
${skillsXml}
  <Config/>
  <Tree activeSpec="1">
    <Spec title="Default" treeVersion="${escXml(treeVer)}" ascendClassId="${ascendClassId}" classId="${classId}" nodes="${nodeHashes.join(',')}"/>
  </Tree>${itemsSectionXml}
  <Notes>
${escXml(notesText)}
  </Notes>
</PathOfBuilding>`;

  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream is not supported by your browser.');
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(xml);
  
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  
  const reader = cs.readable.getReader();
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (value) chunks.push(value);
    if (done) break;
  }
  
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const compressed = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    compressed.set(c, offset);
    offset += c.length;
  }

  // Prepend version byte 0x01
  const payload = new Uint8Array(compressed.length + 1);
  payload[0] = 0x01;
  payload.set(compressed, 1);

  // Convert Uint8Array to base64
  let binary = '';
  const len = payload.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(payload[i]);
  }
  const pobCode = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return { pobCode, xml };
}

async function openPobModal(build) {
  const modal = $('pob-modal');
  const preview = $('pob-export-preview');
  const validationWarning = $('pob-validation-warning');
  
  if (!modal || !preview || !validationWarning) return;

  // Clear previous state
  preview.value = 'Generating PoB code...';
  validationWarning.classList.add('hidden');
  validationWarning.textContent = '';
  modal.classList.remove('hidden');

  // Client-side validations
  if (!build.mainSkill || build.mainSkill.trim() === '') {
    validationWarning.textContent = 'Cannot generate PoB code: missing main skill.';
    validationWarning.classList.remove('hidden');
    preview.value = '';
    return;
  }
  
  if (!build.class || build.class.trim() === '') {
    validationWarning.textContent = 'PoB export may be incomplete: missing class.';
    validationWarning.classList.remove('hidden');
  }

  try {
    const resp = await fetch('/api/ai/pob-export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ build })
    });
    
    if (!resp.ok) {
      throw new Error(`HTTP error ${resp.status}`);
    }
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Response is not JSON (likely stale or offline server)');
    }

    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Failed to export PoB code');

    currentPobCode = data.pobCode;
    currentPobXml = data.xml;
    preview.value = currentPobCode;
  } catch (err) {
    console.warn('Server PoB export failed, attempting client-side fallback:', err);
    try {
      const fallbackResult = await clientSidePobExport(build);
      currentPobCode = fallbackResult.pobCode;
      currentPobXml = fallbackResult.xml;
      preview.value = currentPobCode;
      
      validationWarning.textContent = 'Notice: Stale or offline server detected. Generated PoB code using browser fallback successfully!';
      validationWarning.classList.remove('hidden');
    } catch (fallbackErr) {
      validationWarning.textContent = `Error: ${err.message} (Fallback failed: ${fallbackErr.message})`;
      validationWarning.classList.remove('hidden');
      preview.value = '';
    }
  }
}

function closePobModal() {
  $('pob-modal')?.classList.add('hidden');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Init ─────────────────────────────────────────────────────────────────────

function init() {
  if (!$('provider')) return;

  const s = loadSettings();
  populateSettings(s);
  checkLastBuild();

  // Open settings if no key is configured
  $('ai-settings-details').open = !s.apiKey;

  // Provider change
  $('provider').addEventListener('change', function () {
    updateProviderUI(this.value);
  });

  // Mode tabs
  document.querySelectorAll('.ai-mode-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  // Settings buttons
  $('save-settings').addEventListener('click', saveSettings);
  $('clear-key-btn').addEventListener('click', clearKey);
  $('test-btn').addEventListener('click', testConnection);
  $('key-toggle').addEventListener('click', toggleKeyVisibility);

  // Analyze
  $('analyze-btn').addEventListener('click', analyzeMain);
  $('use-last-build')?.addEventListener('click', useLastBuild);

  // Generate
  $('generate-btn')?.addEventListener('click', generateMain);

  // Data status
  loadDataStatus();
  $('data-refresh-btn')?.addEventListener('click', loadDataStatus);

  // Wire up PoB modal events
  $('close-pob-modal')?.addEventListener('click', closePobModal);
  
  $('copy-pob-code')?.addEventListener('click', function() {
    if (currentPobCode) {
      copyText(currentPobCode, this);
    }
  });

  $('download-pob-txt')?.addEventListener('click', () => {
    if (currentPobCode) {
      downloadFile(currentPobCode, 'pob_code.txt', 'text/plain');
    }
  });

  $('download-pob-xml')?.addEventListener('click', () => {
    if (currentPobXml) {
      downloadFile(currentPobXml, 'pob_build.xml', 'application/xml');
    }
  });
  
  $('pob-modal')?.addEventListener('click', (e) => {
    if (e.target === $('pob-modal')) {
      closePobModal();
    }
  });

  // Tree viewer
  $('tree-reset-btn')?.addEventListener('click', () => { fitTreeView(); scheduleTreeRender(); });

  // Ascendancy toggle
  $('tree-asc-btn')?.addEventListener('click', () => {
    _showAscendancy = !_showAscendancy;
    const btn = $('tree-asc-btn');
    if (btn) btn.textContent = _showAscendancy ? 'Hide Ascendancy' : 'Show Ascendancy';
    fitTreeView();
    scheduleTreeRender();
  });
}

// ── Passive Tree Viewer ──────────────────────────────────────────────────────

let _treeData        = null;   // loaded tree-data.json
let _treeCanvas      = null;
let _treeCtx         = null;
let _treeZoom        = 0.015;
let _treePanX        = 0;
let _treePanY        = 0;
let _treeDragging    = false;
let _treeDragStart   = null;
let _treeAllocated   = new Set(); // node hash strings that are allocated
let _treeSidMap      = {};        // passive string id → hash string
let _treeHovered     = null;
let _treeFrame       = null;
let _showAscendancy  = false;     // toggle: show/hide ascendancy clusters
let _treeStartHash   = null;      // implicit class start used for preview pathing

const TREE_CLASS_START = {
  Warrior: 'MARAUDER',
  Ranger: 'RANGER',
  Witch: 'WITCH',
  Sorceress: 'WITCH',
  Mercenary: 'DUELIST',
  Monk: 'TEMPLAR',
  Druid: 'TEMPLAR',
  Huntress: 'RANGER',
};

async function loadTreeData() {
  if (_treeData) return _treeData;
  const resp = await fetch('/tree-data.json');
  if (!resp.ok) throw new Error(`tree-data.json: HTTP ${resp.status}`);
  _treeData = await resp.json();
  // Build reverse map: string ID → hash
  _treeSidMap = {};
  for (const [hash, node] of Object.entries(_treeData.nodes)) {
    if (node.sid) _treeSidMap[node.sid] = hash;
  }
  return _treeData;
}

function repairTreeAllocationForViewer(passiveIds, build = {}) {
  const nodes = _treeData?.nodes || {};
  const mapped = passiveIds
    .map((id, index) => ({ hash: nodes[String(id)] ? String(id) : _treeSidMap[id], index }))
    .filter(entry => entry.hash && nodes[entry.hash]);
  const unique = [];
  const seen = new Set();
  for (const entry of mapped) {
    if (seen.has(entry.hash)) continue;
    seen.add(entry.hash);
    unique.push(entry);
  }
  const startHash = findTreeClassStartHash(build.class) || inferTreeStartHash(unique);

  const adjacency = buildTreeAdjacency();
  const ascendancy = String(build.ascendancy || '').trim().toLowerCase();
  const mainTargets = unique.filter(({ hash }) => isMainTreePreviewNode(hash));
  const ascTargets = unique.filter(({ hash }) => {
    const node = nodes[hash];
    return node?.a && (!ascendancy || String(node.a).toLowerCase() === ascendancy);
  });

  const main = connectPreviewTargets(mainTargets, {
    adjacency,
    startHash,
    max: 112,
    allow: hash => hash === startHash || isMainTreePreviewNode(hash),
  });
  const asc = connectPreviewTargets(ascTargets, {
    adjacency,
    startHash: findTreeAscendancyStartHash(build.ascendancy),
    max: 8,
    allow: hash => {
      const node = nodes[hash];
      return !!node?.a && (!ascendancy || String(node.a).toLowerCase() === ascendancy);
    },
  });

  const hashes = new Set();
  if (startHash) hashes.add(startHash);
  for (const hash of main.hashes) hashes.add(hash);
  for (const hash of asc.hashes) hashes.add(hash);
  return { hashes: [...hashes], startHash };
}

function buildTreeAdjacency() {
  const adjacency = new Map();
  const nodes = _treeData?.nodes || {};
  const ensure = hash => {
    if (!adjacency.has(hash)) adjacency.set(hash, new Set());
    return adjacency.get(hash);
  };
  for (const hash of Object.keys(nodes)) ensure(hash);
  for (const [hash, node] of Object.entries(nodes)) {
    for (const next of node.c || []) {
      const target = String(next);
      if (!nodes[target]) continue;
      ensure(hash).add(target);
      ensure(target).add(hash);
    }
  }
  return adjacency;
}

function connectPreviewTargets(targets, { adjacency, startHash, max, allow }) {
  const selected = new Set();
  const result = [];
  if (startHash && allow(startHash)) selected.add(startHash);
  else if (targets[0]) selected.add(targets[0].hash);

  const distances = startHash ? treeDistancesFrom(startHash, adjacency, allow) : new Map();
  const ordered = [...targets].sort((a, b) => {
    const da = distances.get(a.hash) ?? Number.MAX_SAFE_INTEGER;
    const db = distances.get(b.hash) ?? Number.MAX_SAFE_INTEGER;
    return da - db || a.index - b.index;
  });

  for (const target of ordered) {
    if (selected.has(target.hash)) {
      addPreviewHash(target.hash, result, max);
      continue;
    }
    const path = shortestTreePathFromSet(selected, target.hash, adjacency, allow);
    if (!path) continue;
    const newHashes = path.filter(hash => shouldDrawAllocatedPreviewNode(hash) && !result.includes(hash));
    if (result.length + newHashes.length > max) continue;
    for (const hash of path) selected.add(hash);
    for (const hash of newHashes) result.push(hash);
  }

  return { hashes: result };
}

function shortestTreePathFromSet(startSet, target, adjacency, allow) {
  if (!target || !allow(target)) return null;
  const queue = [];
  const previous = new Map();
  const visited = new Set();
  for (const start of startSet) {
    if (!allow(start)) continue;
    visited.add(start);
    previous.set(start, null);
    queue.push(start);
  }
  while (queue.length) {
    const hash = queue.shift();
    if (hash === target) return unwindTreePath(previous, target);
    for (const next of adjacency.get(hash) || []) {
      if (!allow(next) || visited.has(next)) continue;
      visited.add(next);
      previous.set(next, hash);
      queue.push(next);
    }
  }
  return null;
}

function treeDistancesFrom(startHash, adjacency, allow) {
  const distances = new Map();
  if (!startHash || !allow(startHash)) return distances;
  const queue = [startHash];
  distances.set(startHash, 0);
  while (queue.length) {
    const hash = queue.shift();
    const nextDistance = distances.get(hash) + 1;
    for (const next of adjacency.get(hash) || []) {
      if (!allow(next) || distances.has(next)) continue;
      distances.set(next, nextDistance);
      queue.push(next);
    }
  }
  return distances;
}

function unwindTreePath(previous, target) {
  const path = [];
  let current = target;
  while (current) {
    path.push(current);
    current = previous.get(current);
  }
  return path.reverse();
}

function addPreviewHash(hash, result, max) {
  if (shouldDrawAllocatedPreviewNode(hash) && !result.includes(hash) && result.length < max) {
    result.push(hash);
  }
}

function shouldDrawAllocatedPreviewNode(hash) {
  const node = _treeData?.nodes?.[hash];
  return !!node && node.t !== 'start';
}

function isMainTreePreviewNode(hash) {
  const node = _treeData?.nodes?.[hash];
  return !!node && !node.a && node.t !== 'jewel' && node.t !== 'start';
}

function findTreeClassStartHash(className) {
  const wanted = TREE_CLASS_START[className] || String(className || '').toUpperCase();
  if (!wanted) return null;
  const found = Object.entries(_treeData?.nodes || {}).find(([, node]) => node.t === 'start' && node.n === wanted);
  return found?.[0] || null;
}

function inferTreeStartHash(mapped) {
  const nodes = _treeData?.nodes || {};
  const firstMain = mapped.find(({ hash }) => isMainTreePreviewNode(hash));
  const starts = Object.entries(nodes).filter(([, node]) => node.t === 'start');
  if (!firstMain || !starts.length) return starts[0]?.[0] || null;
  const target = nodes[firstMain.hash];
  let best = starts[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of starts) {
    const node = entry[1];
    const distance = Math.hypot(node.x - target.x, node.y - target.y);
    if (distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }
  return best?.[0] || null;
}

function findTreeAscendancyStartHash(ascendancy) {
  const wanted = String(ascendancy || '').trim().toLowerCase();
  if (!wanted) return null;
  const found = Object.entries(_treeData?.nodes || {}).find(([, node]) =>
    node.a && String(node.a).toLowerCase() === wanted && node.t === 'ascendancy' && String(node.n).toLowerCase() === wanted
  );
  return found?.[0] || null;
}

async function openTreePanel(build) {
  const panel = $('tree-panel');
  const loading = $('tree-loading');
  if (!panel) return;

  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (loading) loading.classList.remove('hidden');

  try {
    await loadTreeData();
  } catch (err) {
    if (loading) loading.textContent = 'Failed to load tree data: ' + err.message;
    return;
  }

  // Reset ascendancy visibility for each new tree open
  _showAscendancy = false;
  const ascBtn = $('tree-asc-btn');
  if (ascBtn) ascBtn.textContent = 'Show Ascendancy';

  // Map build passives (string IDs) → hash strings
  const passiveIds = (build.passives || []).map(p => typeof p === 'string' ? p : p?.id).filter(Boolean);
  const repaired = repairTreeAllocationForViewer(passiveIds, build);
  _treeAllocated = new Set(repaired.hashes);
  _treeStartHash = repaired.startHash;

  const count = _treeAllocated.size;
  const countEl = $('tree-alloc-count');
  if (countEl) {
    const mainCount = [..._treeAllocated].filter(hash => !_treeData.nodes[hash]?.a && hash !== _treeStartHash).length;
    const ascCount = [..._treeAllocated].filter(hash => _treeData.nodes[hash]?.a).length;
    countEl.textContent = count ? `${mainCount} connected tree nodes${ascCount ? `, ${ascCount} ascendancy` : ''}` : '';
  }

  const canvas = $('tree-canvas');
  if (!canvas) return;

  // Replace canvas to clear old event listeners
  const fresh = canvas.cloneNode(false);
  canvas.parentElement.replaceChild(fresh, canvas);

  // Size canvas to container in device pixels
  const wrap = fresh.parentElement;
  fresh.width  = (wrap.clientWidth  || 900) * devicePixelRatio;
  fresh.height = (wrap.clientHeight || 520) * devicePixelRatio;

  _treeCanvas = fresh;
  _treeCtx    = fresh.getContext('2d');

  fitTreeView();

  fresh.addEventListener('wheel',      onTreeWheel,     { passive: false });
  fresh.addEventListener('mousedown',  onTreeMouseDown);
  fresh.addEventListener('mousemove',  onTreeMouseMove);
  fresh.addEventListener('mouseup',    onTreeMouseUp);
  fresh.addEventListener('mouseleave', () => { _treeDragging = false; _treeHovered = null; scheduleTreeRender(); });
  fresh.addEventListener('dblclick',   () => { fitTreeView(); scheduleTreeRender(); });

  if (loading) loading.classList.add('hidden');
  scheduleTreeRender();
}

function fitTreeView() {
  if (!_treeData || !_treeCanvas) return;
  // Use mainBounds (excludes ascendancy) when ascendancy is hidden, so the
  // main tree fills the canvas rather than leaving it tiny relative to the
  // far-off ascendancy panels.
  const b = (_showAscendancy ? _treeData.bounds : null)
         || _treeData.mainBounds
         || _treeData.bounds;
  // Centre on the selected class start, so the allocation visibly begins at
  // the character start instead of floating around random tree clusters.
  const start = _treeStartHash ? _treeData.nodes[_treeStartHash] : null;
  if (start && !_showAscendancy) {
    const spread = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.58;
    _treePanX = start.x;
    _treePanY = start.y;
    _treeZoom = Math.min(
      _treeCanvas.width  / (spread * 2),
      _treeCanvas.height / (spread * 2)
    ) * 0.92;
  } else {
    // Fallback: fit to bounds
    const pad = (b.maxX - b.minX) * 0.06;
    _treePanX = (b.minX + b.maxX) / 2;
    _treePanY = (b.minY + b.maxY) / 2;
    _treeZoom = Math.min(
      _treeCanvas.width  / (b.maxX - b.minX + pad * 2),
      _treeCanvas.height / (b.maxY - b.minY + pad * 2)
    );
  }
}

function resetTreeView() { fitTreeView(); }

function onTreeWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const rect = _treeCanvas.getBoundingClientRect();
  const dpr  = devicePixelRatio;
  const mx   = (e.clientX - rect.left)  * dpr;
  const my   = (e.clientY - rect.top)   * dpr;
  const wx   = (mx - _treeCanvas.width  / 2) / _treeZoom + _treePanX;
  const wy   = (my - _treeCanvas.height / 2) / _treeZoom + _treePanY;
  _treeZoom  = Math.max(0.005, Math.min(1.5, _treeZoom * factor));
  _treePanX  = wx - (mx - _treeCanvas.width  / 2) / _treeZoom;
  _treePanY  = wy - (my - _treeCanvas.height / 2) / _treeZoom;
  scheduleTreeRender();
}

function onTreeMouseDown(e) {
  _treeDragging  = true;
  _treeDragStart = { x: e.clientX, y: e.clientY, px: _treePanX, py: _treePanY };
}
function onTreeMouseUp() { _treeDragging = false; }

function onTreeMouseMove(e) {
  if (_treeDragging && _treeDragStart) {
    _treePanX = _treeDragStart.px - (e.clientX - _treeDragStart.x) * devicePixelRatio / _treeZoom;
    _treePanY = _treeDragStart.py - (e.clientY - _treeDragStart.y) * devicePixelRatio / _treeZoom;
    scheduleTreeRender();
    return;
  }
  // Hover: find nearest node
  const rect   = _treeCanvas.getBoundingClientRect();
  const dpr    = devicePixelRatio;
  const mx     = (e.clientX - rect.left)  * dpr;
  const my     = (e.clientY - rect.top)   * dpr;
  const wx     = (mx - _treeCanvas.width  / 2) / _treeZoom + _treePanX;
  const wy     = (my - _treeCanvas.height / 2) / _treeZoom + _treePanY;
  const thresh = 300 / _treeZoom;

  let best = null, bestD = thresh;
  for (const [hash, node] of Object.entries(_treeData.nodes)) {
    if (!_showAscendancy && node.a) continue;
    const d = Math.hypot(node.x - wx, node.y - wy);
    if (d < bestD) { bestD = d; best = { hash, node }; }
  }
  if (best !== _treeHovered) { _treeHovered = best; scheduleTreeRender(); }
}

function scheduleTreeRender() {
  if (_treeFrame) return;
  _treeFrame = requestAnimationFrame(() => { _treeFrame = null; renderTree(); });
}

function shouldRenderTreeNode(node) {
  return !!node && (_showAscendancy || !node.a);
}

function treeNodeVisualRadius(node) {
  return { keystone: 76, notable: 46, normal: 27, jewel: 52, ascendancy: 43, start: 24 }[node.t] || 27;
}

function getTreeConnections(node) {
  if (Array.isArray(node.co) && node.co.length) return node.co;
  return (node.c || []).map(id => ({ id: String(id), orbit: 0 }));
}

function drawTreeArc(ctx, cx, cy, radius, a1, a2) {
  let delta = a2 - a1;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  ctx.moveTo(cx + radius * Math.cos(a1), cy + radius * Math.sin(a1));
  ctx.arc(cx, cy, radius, a1, a1 + delta, delta < 0);
}

function drawTreeConnection(ctx, node, target, orbit) {
  if (!node || !target || node.a !== target.a) return;

  const absOrbit = Math.abs(Number(orbit || 0));
  const orbitRadii = _treeData?.constants?.orbitRadii || [];
  if (absOrbit && orbitRadii[absOrbit]) {
    const radius = orbitRadii[absOrbit];
    const dx = target.x - node.x;
    const dy = target.y - node.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0 && dist < radius * 2) {
      const perp = Math.sqrt(Math.max(radius * radius - (dist * dist) / 4, 0)) * (orbit > 0 ? 1 : -1);
      const cx = node.x + dx / 2 + perp * (dy / dist);
      const cy = node.y + dy / 2 - perp * (dx / dist);
      drawTreeArc(ctx, cx, cy, radius, Math.atan2(node.y - cy, node.x - cx), Math.atan2(target.y - cy, target.x - cx));
      return;
    }
  }

  if (node.g && node.g === target.g && node.o === target.o && node.R > 0) {
    drawTreeArc(
      ctx,
      node.gx,
      node.gy,
      node.R,
      Math.atan2(node.y - node.gy, node.x - node.gx),
      Math.atan2(target.y - node.gy, target.x - node.gx)
    );
    return;
  }

  ctx.moveTo(node.x, node.y);
  ctx.lineTo(target.x, target.y);
}

function drawTreeConnectionsLayer(ctx, nodes, allocatedOnly) {
  ctx.beginPath();
  for (const [hash, node] of Object.entries(nodes)) {
    if (!shouldRenderTreeNode(node) || node.t === 'start') continue;
    if (allocatedOnly && !_treeAllocated.has(hash)) continue;
    for (const conn of getTreeConnections(node)) {
      const targetHash = String(conn.id);
      if (targetHash <= hash) continue;
      if (allocatedOnly && !_treeAllocated.has(targetHash)) continue;
      const target = nodes[targetHash];
      if (!shouldRenderTreeNode(target) || target.t === 'start') continue;
      drawTreeConnection(ctx, node, target, Number(conn.orbit || 0));
    }
  }
  ctx.stroke();
}

function renderPobTreeCanvas(ctx, nodes, W, H, z, ox, oy) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = 'rgba(104,96,68,0.62)';
  ctx.lineWidth = 12;
  drawTreeConnectionsLayer(ctx, nodes, false);

  if (_treeAllocated.size) {
    ctx.strokeStyle = 'rgba(238,226,126,0.88)';
    ctx.lineWidth = 18;
    drawTreeConnectionsLayer(ctx, nodes, true);
  }

  const minRadiusPx = 2.5;
  for (const [hash, node] of Object.entries(nodes)) {
    if (!shouldRenderTreeNode(node)) continue;
    const r = Math.max(treeNodeVisualRadius(node), minRadiusPx / z);
    const isAlloc = _treeAllocated.has(hash);
    const isHover = _treeHovered?.hash === hash;

    if (isAlloc) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 26, 0, Math.PI * 2);
      ctx.fillStyle = node.a ? 'rgba(210,145,52,0.22)' : 'rgba(231,225,112,0.24)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    if (isAlloc) {
      ctx.fillStyle = node.a ? '#c8872b' : '#d3c84b';
      ctx.strokeStyle = '#fff0a8';
      ctx.lineWidth = Math.max(9, 1.35 / z);
    } else if (isHover) {
      ctx.fillStyle = '#2c2a21';
      ctx.strokeStyle = '#d4c070';
      ctx.lineWidth = Math.max(7, 1 / z);
    } else {
      ctx.fillStyle = node.t === 'keystone' ? '#201b13'
                    : node.t === 'notable' ? '#151a18'
                    : node.t === 'jewel' ? '#101414'
                    : node.a ? '#1b1414'
                    : '#0d1110';
      ctx.strokeStyle = node.t === 'keystone' ? '#a9904e'
                      : node.t === 'notable' ? '#81713f'
                      : node.t === 'start' ? '#6f6a50'
                      : '#514931';
      ctx.lineWidth = Math.max(4, 0.75 / z);
    }
    ctx.fill();
    ctx.stroke();

    if (node.t === 'notable' || node.t === 'keystone' || node.t === 'jewel') {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 0.58, 0, Math.PI * 2);
      ctx.strokeStyle = isAlloc ? 'rgba(255,245,170,0.65)' : 'rgba(147,126,72,0.45)';
      ctx.lineWidth = Math.max(3, 0.55 / z);
      ctx.stroke();
    }
  }

  ctx.restore();
  drawTreeTooltip(ctx, W, H, z, ox, oy);
}

function drawTreeTooltip(ctx, W, H, z, ox, oy) {
  if (!_treeHovered) return;
  const { hash, node } = _treeHovered;
  const sx = node.x * z + ox;
  const sy = node.y * z + oy;
  const isAlloc = _treeAllocated.has(hash);
  const label = node.n || hash;
  const typeLabel = { keystone: 'Keystone', notable: 'Notable', jewel: 'Jewel Socket',
                      ascendancy: 'Ascendancy', start: 'Class Start', normal: 'Passive' }[node.t] || 'Passive';
  const stats = Array.isArray(node.sd) ? node.sd.slice(0, 2).join(' | ') : '';

  ctx.font = `bold ${13 * devicePixelRatio}px system-ui, sans-serif`;
  const tw = ctx.measureText(label).width;
  const statLabel = stats.length > 70 ? stats.slice(0, 67) + '...' : stats;
  const sw = statLabel ? ctx.measureText(statLabel).width : 0;
  const pw = Math.max(tw, sw, 70 * devicePixelRatio) + 20 * devicePixelRatio;
  const ph = (statLabel ? 64 : 48) * devicePixelRatio;
  const tx = Math.min(Math.max(sx - pw / 2, 4), W - pw - 4);
  const ty = Math.max(4, sy - ph - 14 * devicePixelRatio);

  ctx.fillStyle = 'rgba(6,6,7,0.96)';
  ctx.strokeStyle = isAlloc ? '#d4af37' : '#4d4428';
  ctx.lineWidth = 1.5 * devicePixelRatio;
  treeRoundRect(ctx, tx, ty, pw, ph, 6 * devicePixelRatio);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isAlloc ? '#fff0a8' : '#e8e0c5';
  ctx.textAlign = 'center';
  ctx.fillText(label, tx + pw / 2, ty + 16 * devicePixelRatio);

  ctx.font = `${11 * devicePixelRatio}px system-ui, sans-serif`;
  ctx.fillStyle = isAlloc ? '#d5bd56' : '#9f9678';
  ctx.fillText(typeLabel + (isAlloc ? ' allocated' : ''), tx + pw / 2, ty + 34 * devicePixelRatio);
  if (statLabel) {
    ctx.fillStyle = '#b8b094';
    ctx.fillText(statLabel, tx + pw / 2, ty + 51 * devicePixelRatio);
  }
}

function renderTree() {
  const canvas = _treeCanvas;
  const ctx    = _treeCtx;
  if (!canvas || !ctx || !_treeData) return;

  const W = canvas.width;
  const H = canvas.height;
  const z = _treeZoom;
  const ox = W / 2 - _treePanX * z;
  const oy = H / 2 - _treePanY * z;

  // Background
  ctx.fillStyle = '#020202';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(z, z);

  const nodes = _treeData.nodes;
  renderPobTreeCanvas(ctx, nodes, W, H, z, ox, oy);
  return;

  // ── Ascendancy cluster backgrounds ────────────────────────────────────────
  // When ascendancy is visible, draw faint ellipses around each panel so the
  // clusters are visually grouped and distinguishable from the main tree.
  if (_showAscendancy) {
    const ascGroups = {};
    for (const node of Object.values(nodes)) {
      if (!node.a) continue;
      const g = ascGroups[node.a] || (ascGroups[node.a] = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
      if (node.x < g.minX) g.minX = node.x;
      if (node.x > g.maxX) g.maxX = node.x;
      if (node.y < g.minY) g.minY = node.y;
      if (node.y > g.maxY) g.maxY = node.y;
    }
    const pad = 350;
    for (const [, g] of Object.entries(ascGroups)) {
      const cx = (g.minX + g.maxX) / 2;
      const cy = (g.minY + g.maxY) / 2;
      const rx = Math.max((g.maxX - g.minX) / 2 + pad, pad * 1.5);
      const ry = Math.max((g.maxY - g.minY) / 2 + pad, pad * 1.5);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(90,30,120,0.07)';
      ctx.strokeStyle = 'rgba(140,60,200,0.20)';
      ctx.lineWidth   = 25;
      ctx.fill();
      ctx.stroke();
    }
  }

  // ── Connections ────────────────────────────────────────────────────────────
  // Strategy:
  //  • Same-group, same-orbit connections → draw as arcs (matches game look)
  //  • All other connections → straight lines, filtered to MAX_CONN_DIST
  //
  // Same-orbit chord distances can exceed 1 000 units for the largest orbits,
  // so we skip the distance filter for those and always draw them as arcs.
  // For straight-line connections (cross-group) we cap at 800 units to hide
  // visually confusing long-range links that produce a messy web.
  const MAX_CONN_DIST    = 800;
  const MAX_CONN_DIST_SQ = MAX_CONN_DIST * MAX_CONN_DIST;

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(55,60,90,0.85)';
  ctx.lineWidth   = 22;
  ctx.lineCap     = 'round';

  for (const [hash, node] of Object.entries(nodes)) {
    // Skip ascendancy nodes when panel is hidden
    if (!_showAscendancy && node.a) continue;
    for (const cid of (node.c || [])) {
      if (String(cid) <= hash) continue;        // draw each edge once
      const t = nodes[String(cid)];
      if (!t) continue;
      if (!_showAscendancy && t.a) continue;

      // Same-group, same-orbit → arc along the orbit circle
      const sameOrbit = node.g && node.g === t.g && node.o === t.o && (node.R || 0) > 50;
      if (sameOrbit) {
        const gx   = node.gx, gy = node.gy;
        const arcR = node.R;
        const a1   = Math.atan2(node.y - gy, node.x - gx);
        const a2   = Math.atan2(t.y    - gy, t.x    - gx);
        let   da   = a2 - a1;
        if (da >  Math.PI) da -= 2 * Math.PI;
        if (da < -Math.PI) da += 2 * Math.PI;
        // moveTo arc start to avoid a stray line segment
        ctx.moveTo(gx + arcR * Math.cos(a1), gy + arcR * Math.sin(a1));
        ctx.arc(gx, gy, arcR, a1, a2, da < 0);
      } else {
        // Straight line — skip if too far
        const dx = node.x - t.x, dy = node.y - t.y;
        if (dx * dx + dy * dy > MAX_CONN_DIST_SQ) continue;
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(t.x, t.y);
      }
    }
  }
  ctx.stroke();

  // Allocated connections (gold tint)
  if (_treeAllocated.size) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(212,175,55,0.55)';
    ctx.lineWidth   = 28;
    for (const hash of _treeAllocated) {
      const node = nodes[hash];
      if (!node) continue;
      if (!_showAscendancy && node.a) continue;
      for (const cid of (node.c || [])) {
        if (!_treeAllocated.has(String(cid))) continue;
        const t = nodes[String(cid)];
        if (!t) continue;
        if (!_showAscendancy && t.a) continue;
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(t.x, t.y);
      }
    }
    ctx.stroke();
  }

  // ── Nodes ─────────────────────────────────────────────────────────────────
  // World-space radii for each node type
  const R = { keystone: 80, notable: 55, normal: 35, jewel: 50, ascendancy: 48, start: 75 };
  // Minimum screen-space radius so nodes stay visible at any zoom
  const MIN_R_PX = 2.5;

  for (const [hash, node] of Object.entries(nodes)) {
    if (!_showAscendancy && node.a) continue;
    const rWorld  = R[node.t] || 35;
    const r       = Math.max(rWorld, MIN_R_PX / z);
    const isAlloc = _treeAllocated.has(hash);
    const isHover = _treeHovered?.hash === hash;

    // Glow for allocated keystones / notables
    if (isAlloc && (node.t === 'keystone' || node.t === 'notable')) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212,175,55,0.18)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

    if (isAlloc) {
      ctx.fillStyle   = node.t === 'keystone'   ? '#e8c84b'
                      : node.t === 'notable'    ? '#d4af37'
                      : node.t === 'ascendancy' ? '#c09020'
                      : '#b89018';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth   = Math.max(10, 1.5 / z);
    } else if (isHover) {
      ctx.fillStyle   = '#3a3f5a';
      ctx.strokeStyle = '#5a6090';
      ctx.lineWidth   = Math.max(8, 1 / z);
    } else {
      ctx.fillStyle   = node.t === 'keystone'   ? '#2a1e45'
                      : node.t === 'notable'    ? '#221f3a'
                      : node.t === 'ascendancy' ? '#221830'
                      : node.t === 'start'      ? '#1c1c30'
                      : '#18182a';
      ctx.strokeStyle = node.t === 'keystone'   ? '#5a3a80'
                      : node.t === 'notable'    ? '#3a3060'
                      : node.t === 'start'      ? '#4a4a80'
                      : '#2a2a45';
      ctx.lineWidth   = Math.max(5, 0.8 / z);
    }
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();

  // === Tooltip ===
  if (_treeHovered) {
    const { hash, node } = _treeHovered;
    const sx     = node.x * z + ox;
    const sy     = node.y * z + oy;
    const isAlloc = _treeAllocated.has(hash);
    const label  = node.n || hash;
    const typeLabel = { keystone: 'Keystone', notable: 'Notable', jewel: 'Jewel Socket',
                        ascendancy: 'Ascendancy', start: 'Class Start', normal: 'Passive' }[node.t] || 'Passive';

    ctx.font = `bold ${13 * devicePixelRatio}px system-ui, sans-serif`;
    const tw  = ctx.measureText(label).width;
    const pw  = Math.max(tw, 70 * devicePixelRatio) + 20 * devicePixelRatio;
    const ph  = 48 * devicePixelRatio;
    const tx  = Math.min(Math.max(sx - pw / 2, 4), W - pw - 4);
    const ty  = sy - ph - 14 * devicePixelRatio;

    ctx.fillStyle   = 'rgba(13,13,20,0.96)';
    ctx.strokeStyle = isAlloc ? '#d4af37' : '#3a3a55';
    ctx.lineWidth   = 1.5 * devicePixelRatio;
    treeRoundRect(ctx, tx, ty, pw, ph, 6 * devicePixelRatio);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = isAlloc ? '#ffd700' : '#dde0f0';
    ctx.textAlign = 'center';
    ctx.fillText(label, tx + pw / 2, ty + 16 * devicePixelRatio);

    ctx.font      = `${11 * devicePixelRatio}px system-ui, sans-serif`;
    ctx.fillStyle = isAlloc ? '#c8a020' : '#6a6e8a';
    ctx.fillText(typeLabel + (isAlloc ? '  ✓ allocated' : ''), tx + pw / 2, ty + 34 * devicePixelRatio);
  }
}

function treeRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

document.addEventListener('DOMContentLoaded', init);
