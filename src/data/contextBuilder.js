/**
 * Builds a concise context block for AI prompts from official patch notes and cached PoE2DB data.
 * Limits output to MAX_CONTEXT_CHARS to avoid exceeding model token limits.
 */
import { readCache } from './store.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_CONTEXT_CHARS = 48_000;
const MAX_PATCHES       = 5;
const MAX_GEMS          = 115;
const MAX_PASSIVES      = 150;
const MAX_UNIQUES       = 30;

// ── Live API Caching & Fetching ───────────────────────────────────────────────
// ── Keyword extraction ────────────────────────────────────────────────────────

const KEYWORD_MAP = {
  fire:       ['fire','ignite','burn','combustion','pyroclast','inferno','meteor','comet'],
  cold:       ['cold','freeze','chill','frost','ice','blizzard'],
  lightning:  ['lightning','shock','thunder','storm','arc','static'],
  chaos:      ['chaos','poison','wither','blight','essence','contagion'],
  physical:   ['physical','bleed','armour','slam','strike','crushing'],
  spell:      ['spell','cast','channeling','channel'],
  attack:     ['attack','hit','melee','bow','projectile'],
  minion:     ['minion','zombie','skeleton','spectre','golem','summon'],
  aura:       ['aura','banner','war cry','herald'],
  movement:   ['dash','blink','evade','movement'],
  support:    ['support','link','trigger'],
};

function extractKeywords(text) {
  if (!text) return [];
  const lower = text.toLowerCase()
    .replace(/poisen/g, 'poison')
    .replace(/nerfes/g, 'nerf')
    .replace(/nerfed/g, 'nerf')
    .replace(/uniques/g, 'unique')
    .replace(/head hunter/g, 'headhunter');
    
  const found = new Set();
  for (const [kw, terms] of Object.entries(KEYWORD_MAP)) {
    if (terms.some(t => lower.includes(t))) found.add(kw);
  }
  
  if (lower.includes('headhunter') || lower.includes('leather-belt')) {
    found.add('headhunter');
  }
  
  // Also add any MECHANIC_KEYWORDS directly mentioned
  const direct = [
    'fireball','arc','comet','ice nova','ground slam','raise zombie','raise spectre',
    'essence drain','contagion','volcanic fissure','heavy strike','shield crush',
    'spark','ball lightning','flameblast','freezing pulse','tornado shot',
    'sorceress','witch','warrior','ranger','monk','mercenary','huntress','druid',
    'infernalist','stormweaver','deadeye','pathfinder','titan','warbringer',
    'oracle','invoker','amazon','tactician','blood mage','witchhunter',
    'headhunter',
  ];
  for (const d of direct) {
    if (lower.includes(d)) found.add(d.replace(/ /g, '-'));
  }
  return [...found];
}

// ── Data retrieval ────────────────────────────────────────────────────────────

async function getRelevantPatches(keywords) {
  const patches = await readCache('patches');
  if (!patches?.length) return [];
  if (!keywords.length) return patches.slice(0, MAX_PATCHES);
  const scored = patches.map(p => {
    const kws = p.keywords || [];
    const haystack = `${p.title || ''} ${p.summary || ''}`.toLowerCase();
    
    let score = keywords.filter(k => kws.includes(k)).length;
    // Add additional score for string match in title/summary (e.g. poison or nerfs)
    for (const k of keywords) {
      const term = k.replace(/-/g, ' ');
      if (haystack.includes(term)) {
        score += 2;
      }
    }
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return (scored.length ? scored.map(x => x.p) : patches).slice(0, MAX_PATCHES);
}

async function getRelevantGems(keywords) {
  const gems = await readCache('gems');
  if (!gems?.length) return [];
  if (!keywords.length) return gems.slice(0, MAX_GEMS);
  const kset = new Set(keywords);
  const scored = gems.map(g => {
    const tags = g.tags || [];
    const isSupport = g.type === 'support';
    let score = tags.filter(t => kset.has(t)).length;
    if (kset.has(g.name?.toLowerCase().replace(/ /g, '-'))) score += 10;
    // Always give support gems a small base score so they are present in the context
    if (isSupport) score += 1.5;
    return { g, score };
  }).sort((a, b) => b.score - a.score);
  return scored.map(x => x.g).slice(0, MAX_GEMS);
}

async function getRelevantPassives(keywords) {
  if (!keywords.length) return [];
  try {
    const raw = await readFile(path.join(__dirname, 'passives_default.json'), 'utf8');
    const tree = JSON.parse(raw);
    const graph = await readPassiveTreeGraph();
    const nodes = Object.values(tree || {}).filter(n =>
      n.name && keywords.some(k => {
        const statsStr = Array.isArray(n.stats) ? n.stats.join(' ') : '';
        const haystack = `${n.name} ${statsStr} ${n.ascendancy || ''} ${n.id || ''}`.toLowerCase();
        return haystack.includes(k);
      })
    );
    return nodes.slice(0, MAX_PASSIVES).map(n => ({
      id:    n.id,
      name:  n.name,
      stats: n.stats,
      type:  n.is_keystone ? 'keystone' : n.is_notable ? 'notable' : 'normal',
      connectedTo: graph.get(n.id)?.connectedTo || [],
    }));
  } catch (err) {
    console.error('Failed to get passives:', err);
    return [];
  }
}

async function readPassiveTreeGraph() {
  try {
    const raw = await readFile(path.join(__dirname, '..', '..', 'public', 'tree-data.json'), 'utf8');
    const tree = JSON.parse(raw);
    const sidByHash = new Map();
    const nodeBySid = new Map();
    for (const [hash, node] of Object.entries(tree.nodes || {})) {
      if (!node.sid) continue;
      sidByHash.set(hash, node.sid);
      nodeBySid.set(node.sid, { hash, node });
    }

    const graph = new Map();
    for (const [sid, entry] of nodeBySid) {
      const connectedTo = (entry.node.c || [])
        .map((hash) => sidByHash.get(hash))
        .filter(Boolean)
        .slice(0, 5);
      graph.set(sid, { hash: entry.hash, connectedTo });
    }
    return graph;
  } catch {
    return new Map();
  }
}

// ── Context formatter ─────────────────────────────────────────────────────────

function fmtPatches(patches) {
  if (!patches.length) return '';
  const lines = ['## Recent Patch Notes (verified source: pathofexile.com/forum/view-forum/2212)'];
  for (const p of patches) {
    lines.push(`### ${p.title}${p.date ? ` (${p.date})` : ''}`);
    if (p.summary) lines.push(p.summary.slice(0, 500));
    lines.push('');
  }
  return lines.join('\n');
}

function getGggGemId(name, isSupport) {
  const cleanName = name
    .replace(/\bSupport\b/gi, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  
  if (isSupport) {
    return `Metadata/Items/Gems/SupportGem${cleanName}`;
  } else {
    return `Metadata/Items/Gem/SkillGem${cleanName}`;
  }
}

function fmtGems(gems) {
  if (!gems.length) return '';
  const lines = ['## Relevant Skill & Support Gems (PoE2DB import)'];
  for (const g of gems) {
    const gggId = getGggGemId(g.name, g.type === 'support');
    lines.push(`- **${g.name}** [${g.type}] (GGG ID: "${gggId}") tags: ${(g.tags||[]).join(', ')}${g.desc ? ' — ' + g.desc : ''}`);
  }
  return lines.join('\n');
}

function fmtPassives(passives) {
  if (!passives.length) return '';
  const lines = ['## Relevant Passive Nodes (bundled PoE2 tree; IDs are connected/validated against PathOfBuildingCommunity/PathOfBuilding-PoE2 tree data)'];
  for (const p of passives) {
    const links = p.connectedTo?.length ? ` Connected IDs: ${p.connectedTo.map(id => `"${id}"`).join(', ')}.` : '';
    lines.push(`- **${p.name}** (${p.type}) [ID: "${p.id}"]: ${(p.stats||[]).join('; ')}.${links}`);
  }
  return lines.join('\n');
}

async function getRelevantUniques(keywords) {
  const uniques = await readCache('uniques');
  if (!uniques?.length) return [];
  if (!keywords.length) return uniques.slice(0, 10);
  const kset = new Set(keywords);
  const scored = uniques.map(u => {
    const slug = u.id || '';
    const nameLower = u.name?.toLowerCase() || '';
    let score = 0;
    if (keywords.some(k => nameLower.includes(k.replace(/-/g, ' ')))) score += 5;
    if (keywords.some(k => slug.includes(k))) score += 5;
    if (keywords.some(k => u.base?.toLowerCase().includes(k))) score += 1;
    return { u, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.map(x => x.u).slice(0, MAX_UNIQUES);
}

function fmtUniques(uniques, liveUniquePrices = {}) {
  if (!uniques.length) return '';
  const lines = ['## Relevant Unique Items (PoE2DB import)'];
  for (const u of uniques) {
    const live = liveUniquePrices[u.name];
    const priceText = live ? ` [Market Value: ~${Math.round(live.price)} Chaos Orbs]` : '';
    lines.push(`- **${u.name}** (${u.base})${priceText} — ${u.category}${u.requires ? ` [Requires: ${u.requires}]` : ''}`);
    for (const m of u.mods || []) {
      lines.push(`  * ${m}`);
    }
  }
  return lines.join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build context string for the given user query / build text.
 * Returns { context: string, sources: string[], truncated: boolean }
 */
export async function buildContext(query = '') {
  const keywords = extractKeywords(query);

  const [
    patches,
    gems,
    passives,
    uniques,
  ] = await Promise.all([
    getRelevantPatches(keywords),
    getRelevantGems(keywords),
    getRelevantPassives(keywords),
    getRelevantUniques(keywords),
  ]);

  const sections = [];
  const sources  = [];
 
  const patchText = fmtPatches(patches);
  if (patchText)   { sections.push(patchText);   sources.push(`patches (${patches.length})`); }
 
  const gemText = fmtGems(gems);
  if (gemText)     { sections.push(gemText);     sources.push(`gems (${gems.length})`); }
 
  const passiveText = fmtPassives(passives);
  if (passiveText) { sections.push(passiveText); sources.push(`passives (${passives.length})`); }

  const uniquesText = fmtUniques(uniques);
  if (uniquesText) { sections.push(uniquesText); sources.push(`uniques (${uniques.length})`); }
 
  let context   = sections.join('\n\n');
  let truncated = false;
  if (context.length > MAX_CONTEXT_CHARS) {
    context   = context.slice(0, MAX_CONTEXT_CHARS) + '\n\n[Context truncated to fit token limit]';
    truncated = true;
  }
 
  return { context, sources, keywords, truncated };
}
 
/** Score confidence based on which data sources support the answer. */
export function scoreConfidence(sources) {
  if (sources.some(s => s.startsWith('patches'))) return 'verified';
  if (
    sources.some(s => s.startsWith('gems')) ||
    sources.some(s => s.startsWith('passives')) ||
    sources.some(s => s.startsWith('uniques'))
  ) {
    return 'likely';
  }
  if (sources.length > 0) return 'uncertain';
  return 'unsupported';
}
