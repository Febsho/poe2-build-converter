/**
 * Enhanced AI routes with live PoE2 data context.
 * POST /api/ai/context   — returns the context that would be sent to the AI (transparency)
 * POST /api/ai/analyze   — analyze a build with live data context
 * POST /api/ai/generate  — generate a build suggestion with live data context
 *
 * User API key behaviour is identical to /api/ai/proxy:
 * key comes from x-ai-key header, never stored or logged.
 */
import { Router } from 'express';
import { buildContext, scoreConfidence } from '../data/contextBuilder.js';
import { generatePobCodeFromAiBuild } from '../features/ai/lib/pobExport.ts';
import { repairAiBuildPassives } from '../features/ai/lib/passiveTree.js';
import { decodePobCode } from '../pobParser.js';

const router = Router();

const SYSTEM_PROMPT = `You are a Path of Exile 2 build assistant integrated into a build converter website.
You have access to verified PoE2 data provided below. Use it as your primary source of truth.
If the data below does not cover a topic, say so clearly rather than guessing from training data.
When uncertain, mark your recommendation as uncertain.
Return structured JSON when requested. Never claim a build is fully verified unless the data proves it.
Focus on helping the user improve, analyze, or convert PoE2 builds.

## Official PoE2 Classes and Ascendancies:
- Warrior: Titan, Warbringer, Smith of Kitava
- Ranger: Deadeye, Pathfinder
- Witch: Infernalist, Blood Mage, Lich, Abyssal Lich
- Sorceress: Stormweaver, Chronomancer, Disciple of Varashta
- Druid: Oracle, Shaman
- Huntress: Amazon, Ritualist
- Monk: Invoker, Acolyte of Chayula
- Mercenary: Tactician, Witchhunter, Gemling Legionnaire

CONFIDENCE LEVELS:
- verified: information comes directly from patch notes or official data
- likely: information is from PoE2DB or passive tree data
- uncertain: information inferred from context or partially supported
- unsupported: no data available; answer is from training data only`;

// ── Context endpoint ──────────────────────────────────────────────────────────

router.post('/context', async (req, res) => {
  const query = req.body?.query || '';
  try {
    const result = await buildContext(query);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to build context.' });
  }
});

// ── Analyze endpoint ──────────────────────────────────────────────────────────

router.post('/analyze', async (req, res) => {
  const apiKey = req.headers['x-ai-key'];
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 4) {
    return res.status(401).json({ ok: false, error: 'Missing or invalid API key.' });
  }

  const { provider, model, temperature, maxTokens, baseUrl, buildText, query } = req.body ?? {};
  if (!buildText && !query) {
    return res.status(400).json({ ok: false, error: 'buildText or query is required.' });
  }

  const combinedQuery = `${buildText || ''} ${query || ''}`.trim();
  const { context, sources, keywords, truncated } = await buildContext(combinedQuery);
  const confidence = scoreConfidence(sources);

  const messages = buildAnalyzeMessages(context, buildText, query);

  try {
    const content = await callProxy({ apiKey: apiKey.trim(), provider, model, temperature, maxTokens, baseUrl, messages });
    const repaired = repairGeneratedBuildContent(content);
    res.json({ ok: true, content: repaired.content, passiveTree: repaired.stats, confidence, sources, keywords, contextTruncated: truncated });
  } catch (err) {
    const { status, message } = sanitizeError(err);
    res.status(status).json({ ok: false, error: message });
  }
});

// ── Generate endpoint ─────────────────────────────────────────────────────────

router.post('/generate', (_req, res) => {
  res.status(410).json({
    ok: false,
    error: 'Build generation is disabled while the generator is being rebuilt.',
  });
});

// ── PoB Export endpoint ──────────────────────────────────────────────────────

router.post('/pob-export', (req, res) => {
  const { build } = req.body ?? {};
  if (!build) {
    return res.status(400).json({ ok: false, error: 'Missing "build" object in request body.' });
  }

  try {
    const { build: repairedBuild } = repairAiBuildPassives(build);
    const pobCode = generatePobCodeFromAiBuild(repairedBuild);
    let xml = '';
    try {
      xml = decodePobCode(pobCode);
    } catch (decodeErr) {
      // Fallback if decoding fails, though it shouldn't
      console.error('Failed to decode generated PoB code:', decodeErr);
    }
    return res.json({ ok: true, pobCode, xml });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// ── Message builders ──────────────────────────────────────────────────────────

function buildAnalyzeMessages(context, buildText, query) {
  const systemContent = context
    ? `${SYSTEM_PROMPT}\n\n## Current PoE2 Database Context\n${context}`
    : SYSTEM_PROMPT;

  const userParts = [];
  if (buildText) userParts.push(`## Build to Analyze\n${buildText}`);
  if (query)     userParts.push(`## Question / Focus\n${query}`);

  return [
    { role: 'system',  content: systemContent },
    { role: 'user',    content: userParts.join('\n\n') || 'Please analyze this build.' },
  ];
}

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
  "confidence": "verified | likely | uncertain | unsupported",
  "passives": ["string"],
  "skills": [
    {
      "id": "string",
      "level_interval": [1, 100],
      "support_skills": [
        { "id": "string", "level_interval": [1, 100] }
      ]
    }
  ],
  "items": [
    {
      "inventory_id": "BodyArmour | Weapon | Offhand | Helm | Gloves | Boots | Belt | Amulet | Ring | Ring2",
      "unique_name": "string",
      "level_interval": [1, 100],
      "additional_text": "string"
    }
  ]
}`;

function buildGenerateMessages(context, query) {
  const systemContent = context
    ? `${SYSTEM_PROMPT}\n\n## Current PoE2 Database Context\n${context}`
    : SYSTEM_PROMPT;

  const contentPrompt = `Generate a Path of Exile 2 build matching the user's request.
Your response MUST be a single, valid JSON object matching the schema below.

## Database & Naming Constraints (CRITICAL):
1. Ground your recommendations strictly in the "Current PoE2 Database Context" provided in the system prompt. Use the official names of gems, items, classes, and ascendancies.
2. Under "passives", output 35 to 70 high-value passive node IDs from the provided passive context as build targets, not random tree decorations. Pick nodes that make sense for the chosen class/ascendancy and archetype. The server will expand these targets into a legal connected allocation using PathOfBuildingCommunity/PathOfBuilding-PoE2 tree graph data. Ascendancy IDs are capped at 8 obtainable points.
3. Under "skills", generate at least 5 to 9 complete skill groups representing all active skills of a full character setup:
   - You MUST include 1 main 6-linked active skill group, 1 secondary active skill group, 2-3 utility/aura/herald/warcry skill groups, and 1 movement skill group (totaling at least 5 to 9 active skill groups).
   - Make sure the main active skill has 5 linked support gems.
   - Use ONLY the official GGG Gem IDs provided in the "GGG ID" field inside the database context list (e.g., "Metadata/Items/Gem/SkillGem..." or "Metadata/Items/Gems/SupportGem..."). Do NOT invent, guess, or hallucinate any gem IDs. Every single gem you recommend must map to a real gem that exists in the database context.
4. Under "items", generate a full best-in-slot itemization setup of at least 10 to 14 items:
   - You MUST populate all slots: Helm, BodyArmour, Gloves, Boots, Weapon, Offhand, Amulet, Belt, Ring, Ring2, and active Flasks (totaling at least 10 to 14 items).
   - Specify "inventory_id" slot names.
   - Specify "unique_name" (e.g., "The Covenant" or "Bisco's Collar").
   - Under "additional_text", provide the complete Path of Exile 2 hover text for that item (implicits, explicits, rarity, etc.) in official nomenclature.
5. Ensure every schema field is fully populated with rich, realistic, min-maxed details. Do not use empty arrays, placeholders, or truncated fields.

## Required JSON Schema:
${GENERATE_SCHEMA}

Request: ${query}`;

  return [
    { role: 'system', content: systemContent },
    { role: 'user',   content: contentPrompt },
  ];
}

// ── Provider dispatch (shared logic, mirrors proxy.js) ────────────────────────

function repairGeneratedBuildContent(content) {
  const parsed = parseGeneratedJson(content);
  if (!parsed || typeof parsed !== 'object') {
    return { content, stats: null };
  }

  const { build, stats } = repairAiBuildPassives(parsed);
  return {
    content: JSON.stringify(build, null, 2),
    stats,
  };
}

function parseGeneratedJson(content) {
  const raw = String(content || '').trim();
  if (!raw) return null;
  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

const ALLOWED_PROVIDERS = new Set(['openai', 'openrouter', 'anthropic', 'gemini', 'custom']);
const MAX_MESSAGES = 20;
const MAX_CONTENT_LEN = 128_000;

async function callProxy({ apiKey, provider, model, temperature, maxTokens, baseUrl, messages }) {
  if (!ALLOWED_PROVIDERS.has(provider)) throw Object.assign(new Error(`Unknown provider "${provider}".`), { status: 400 });
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) throw Object.assign(new Error('Invalid messages.'), { status: 400 });
  for (const m of messages) {
    if (!['system','user','assistant'].includes(m.role)) throw Object.assign(new Error(`Bad role "${m.role}".`), { status: 400 });
    if (m.content.length > MAX_CONTENT_LEN) throw Object.assign(new Error('Message too long.'), { status: 400 });
  }

  // Forward to proxy handler internals — re-use same fetch logic via internal call
  const proxyRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/ai/proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ai-key': apiKey,
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify({ provider, model, temperature, maxTokens, baseUrl, messages }),
    signal: AbortSignal.timeout(95_000),
  });
  const data = await proxyRes.json();
  if (!data.ok) throw Object.assign(new Error(data.error || 'Proxy error'), { status: proxyRes.status });
  return data.content;
}

function sanitizeError(err) {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  const clean  = String(err.message || 'Request failed').slice(0, 300).replace(/[A-Za-z0-9_-]{20,}/g, '[redacted]');
  return { status, message: clean };
}

export default router;
