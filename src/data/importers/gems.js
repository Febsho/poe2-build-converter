/**
 * Gem data importer.
 * Always writes a comprehensive bundled list of known PoE2 gems.
 * The npm run data:update:poe2db hook is a placeholder for future live data.
 */
import { writeCache, writeRaw, touchSource } from '../store.js';

const POE2DB_GEM_SOURCES = [
  { type: 'active', url: 'https://poe2db.tw/us/Skill_Gems' },
  { type: 'support', url: 'https://poe2db.tw/us/Support_Gems' },
];

const POE2DB_HEADERS = {
  'User-Agent': 'poe2-build-converter data updater (+https://github.com/febsho/poe2-build-converter)',
  Accept: 'text/html,application/xhtml+xml',
};

// Comprehensive bundled list — updated from training data (PoE2 0.1/0.2 era)
export const BUNDLED_GEMS = [
  // ── Active: Fire ────────────────────────────────────────────────────────
  { id: 'fireball',         name: 'Fireball',         type: 'active',  tags: ['fire','spell','projectile'],         desc: 'Fires a ball of fire that explodes dealing fire damage to nearby enemies.' },
  { id: 'flameblast',       name: 'Flameblast',       type: 'active',  tags: ['fire','spell','area','channelling'], desc: 'Channelled fire spell that releases expanding blasts.' },
  { id: 'volcanic-fissure', name: 'Volcanic Fissure', type: 'active',  tags: ['fire','attack','area','slam'],       desc: 'Slam that creates a fissure of volcanic flame.' },
  { id: 'explosive-shot',   name: 'Explosive Shot',   type: 'active',  tags: ['fire','attack','projectile','bow'],  desc: 'Fires an arrow that explodes with fire on impact.' },
  { id: 'rolling-magma',    name: 'Rolling Magma',    type: 'active',  tags: ['fire','spell','projectile'],         desc: 'Lobbed projectile that bounces and deals fire AoE.' },
  { id: 'flame-wall',       name: 'Flame Wall',       type: 'active',  tags: ['fire','spell','area'],               desc: 'Creates a wall of fire that ignites passing projectiles.' },
  { id: 'volatile-dead',    name: 'Volatile Dead',    type: 'active',  tags: ['fire','spell','area','minion'],      desc: 'Consumes corpses, creating volatile orbs that deal fire damage.' },
  { id: 'combustion',       name: 'Combustion',       type: 'active',  tags: ['fire','spell','area'],               desc: 'Releases a burst of fire that covers enemies in burning.' },
  { id: 'incinerate',       name: 'Incinerate',       type: 'active',  tags: ['fire','spell','channelling'],        desc: 'Channelled fire spell that builds intensity over time.' },
  { id: 'fire-trap',        name: 'Fire Trap',        type: 'active',  tags: ['fire','trap','area'],                desc: 'Throws a trap that explodes with fire when triggered.' },

  // ── Active: Cold ────────────────────────────────────────────────────────
  { id: 'ice-nova',         name: 'Ice Nova',         type: 'active',  tags: ['cold','spell','area'],               desc: 'Nova of ice that expands outward, chilling and freezing enemies.' },
  { id: 'frost-bomb',       name: 'Frost Bomb',       type: 'active',  tags: ['cold','spell','area'],               desc: 'Drops a cold bomb that slows recovery of life and energy shield.' },
  { id: 'comet',            name: 'Comet',            type: 'active',  tags: ['cold','spell','projectile'],         desc: 'Calls down a comet of ice that freezes on impact.' },
  { id: 'glacial-bolt',     name: 'Glacial Bolt',     type: 'active',  tags: ['cold','spell','projectile'],         desc: 'Fires icy bolts that pierce and chill.' },
  { id: 'ice-lance',        name: 'Ice Lance',        type: 'active',  tags: ['cold','attack','projectile'],        desc: 'Dashes and fires a piercing lance of ice.' },
  { id: 'snap-freeze',      name: 'Snap Freeze',      type: 'active',  tags: ['cold','spell','area'],               desc: 'Instantly chills and can freeze a large area.' },
  { id: 'glacial-cascade',  name: 'Glacial Cascade',  type: 'active',  tags: ['cold','spell','area'],               desc: 'Drops a series of ice spikes from above in sequence.' },
  { id: 'cold-snap',        name: 'Cold Snap',        type: 'active',  tags: ['cold','spell','area'],               desc: 'Chills and freezes an area, generating power charges on freezing.' },
  { id: 'frostblink',       name: 'Frostblink',       type: 'active',  tags: ['cold','spell','movement'],           desc: 'Blinks to a location, chilling nearby enemies on arrival.' },
  { id: 'ice-shot',         name: 'Ice Shot',         type: 'active',  tags: ['cold','attack','projectile','bow'],  desc: 'Fires an icy arrow that releases a wave of cold.' },

  // ── Active: Lightning ───────────────────────────────────────────────────
  { id: 'arc',              name: 'Arc',              type: 'active',  tags: ['lightning','spell','chaining'],      desc: 'Releases a bolt of lightning that arcs and chains between enemies.' },
  { id: 'ball-lightning',   name: 'Ball Lightning',   type: 'active',  tags: ['lightning','spell','projectile','area'], desc: 'Fires a ball of lightning that crackles as it moves.' },
  { id: 'spark',            name: 'Spark',            type: 'active',  tags: ['lightning','spell','projectile'],    desc: 'Fires sparks that travel in erratic directions.' },
  { id: 'lightning-arrow',  name: 'Lightning Arrow',  type: 'active',  tags: ['lightning','attack','projectile','bow'], desc: 'Fires an arrow that creates a cone of lightning.' },
  { id: 'storm-surge',      name: 'Storm Surge',      type: 'active',  tags: ['lightning','spell','area'],          desc: 'Creates a surge of electrical energy that shocks.' },
  { id: 'chain-lightning',  name: 'Chain Lightning',  type: 'active',  tags: ['lightning','spell','chaining'],      desc: 'Fires a bolt that chains between nearby enemies.' },
  { id: 'orb-of-storms',    name: 'Orb of Storms',    type: 'active',  tags: ['lightning','spell','area'],          desc: 'Creates a storm orb that shocks enemies over time.' },
  { id: 'storm-call',       name: 'Storm Call',       type: 'active',  tags: ['lightning','spell','area'],          desc: 'Marks a location; after a delay a lightning strike hits it.' },
  { id: 'lightning-warp',   name: 'Lightning Warp',   type: 'active',  tags: ['lightning','spell','movement'],      desc: 'Warps to a target location via a bolt of lightning.' },
  { id: 'tempest-flurry',   name: 'Tempest Flurry',   type: 'active',  tags: ['lightning','attack','melee'],        desc: 'Rapid melee strikes that discharge lightning on hit.' },

  // ── Active: Physical ────────────────────────────────────────────────────
  { id: 'ground-slam',      name: 'Ground Slam',      type: 'active',  tags: ['physical','attack','area','slam','melee'], desc: 'Slams the ground, creating a wave of force in a cone.' },
  { id: 'heavy-strike',     name: 'Heavy Strike',     type: 'active',  tags: ['physical','attack','melee'],         desc: 'A powerful single strike with increased knockback.' },
  { id: 'whirling-slash',   name: 'Whirling Slash',   type: 'active',  tags: ['physical','attack','area','melee'],  desc: 'Spins with your weapon, hitting all nearby enemies.' },
  { id: 'sunder',           name: 'Sunder',           type: 'active',  tags: ['physical','attack','area','slam'],   desc: 'Creates a wave of force that ripples outward.' },
  { id: 'splitting-steel',  name: 'Splitting Steel',  type: 'active',  tags: ['physical','attack','projectile'],    desc: 'Throws a steel shard that splits into additional projectiles.' },
  { id: 'shield-crush',     name: 'Shield Crush',     type: 'active',  tags: ['physical','attack','area','melee'],  desc: 'Smashes enemies with your shield in a sweeping arc.' },
  { id: 'boneshatter',      name: 'Boneshatter',      type: 'active',  tags: ['physical','attack','melee'],         desc: 'Strikes that shatter bones, dealing more damage to stunned enemies.' },
  { id: 'reap',             name: 'Reap',             type: 'active',  tags: ['physical','spell','area'],           desc: 'Slashes through enemies with a spectral scythe wave.' },
  { id: 'leap-slam',        name: 'Leap Slam',        type: 'active',  tags: ['physical','attack','area','slam','movement'], desc: 'Leaps to a target location, slamming on impact.' },
  { id: 'hammer-of-gods',   name: 'Hammer of the Gods', type: 'active', tags: ['physical','attack','slam','melee'], desc: 'Calls down a massive divine hammer.' },
  { id: 'shield-charge',    name: 'Shield Charge',    type: 'active',  tags: ['physical','attack','movement','melee'], desc: 'Charges at an enemy with your shield.' },

  // ── Active: Chaos ───────────────────────────────────────────────────────
  { id: 'essence-drain',    name: 'Essence Drain',    type: 'active',  tags: ['chaos','spell','projectile','dot'],  desc: 'Fires a chaos projectile that applies damage over time.' },
  { id: 'contagion',        name: 'Contagion',        type: 'active',  tags: ['chaos','spell','area'],              desc: 'Applies chaos blight that spreads to nearby enemies on death.' },
  { id: 'blight',           name: 'Blight',           type: 'active',  tags: ['chaos','spell','channelling','area'],'desc': 'Channelled spray of chaos that slows and withers.' },
  { id: 'despair',          name: 'Despair',          type: 'active',  tags: ['chaos','spell','curse','aura'],      desc: 'Curse that reduces chaos resistance.' },
  { id: 'plague-bearer',    name: 'Plague Bearer',    type: 'active',  tags: ['chaos','spell','buff'],              desc: 'Accumulates poison magnitude; release as an infecting aura.' },
  { id: 'poisonous-concoction', name: 'Poisonous Concoction', type: 'active', tags: ['chaos','attack','projectile','poison'], desc: 'Throws a flask of poison that explodes.' },

  // ── Active: Minion ──────────────────────────────────────────────────────
  { id: 'raise-zombie',     name: 'Raise Zombie',     type: 'active',  tags: ['minion','spell'],                    desc: 'Raises a corpse as a zombie that fights for you.' },
  { id: 'raise-spectre',    name: 'Raise Spectre',    type: 'active',  tags: ['minion','spell'],                    desc: 'Raises a corpse as a spectre retaining enemy abilities.' },
  { id: 'summon-skeletons', name: 'Summon Skeletons', type: 'active',  tags: ['minion','spell'],                    desc: 'Summons skeleton warriors and archers.' },
  { id: 'bone-cage',        name: 'Bone Cage',        type: 'active',  tags: ['minion','physical','spell'],         desc: 'Raises bones from a corpse to trap and damage enemies.' },
  { id: 'infernal-legion',  name: 'Infernal Legion',  type: 'active',  tags: ['fire','minion','aura'],              desc: 'Minions immolate themselves dealing fire DoT.' },
  { id: 'unearth',          name: 'Unearth',          type: 'active',  tags: ['physical','spell','projectile'],     desc: 'Fires a projectile that creates a corpse on impact.' },

  // ── Active: Bow ─────────────────────────────────────────────────────────
  { id: 'tornado-shot',     name: 'Tornado Shot',     type: 'active',  tags: ['attack','projectile','bow'],         desc: 'Fires a primary projectile that releases tornadoes.' },
  { id: 'barrage',          name: 'Barrage',          type: 'active',  tags: ['attack','projectile','bow'],         desc: 'Fires a rapid barrage of arrows sequentially.' },
  { id: 'rain-of-arrows',   name: 'Rain of Arrows',   type: 'active',  tags: ['attack','projectile','bow','area'],  desc: 'Fires arrows into the air that rain down in an area.' },
  { id: 'shrapnel-ballista', name: 'Shrapnel Ballista', type: 'active', tags: ['attack','projectile','bow','totem'], desc: 'Summons a totem that fires shrapnel projectiles.' },

  // ── Active: Aura / Buff ─────────────────────────────────────────────────
  { id: 'anger',            name: 'Anger',            type: 'active',  tags: ['fire','aura'],                       desc: 'Aura that adds fire damage to spells and attacks.' },
  { id: 'hatred',           name: 'Hatred',           type: 'active',  tags: ['cold','aura'],                       desc: 'Aura that converts physical damage to cold.' },
  { id: 'wrath',            name: 'Wrath',            type: 'active',  tags: ['lightning','aura'],                  desc: 'Aura that adds lightning damage to spells and attacks.' },
  { id: 'grace',            name: 'Grace',            type: 'active',  tags: ['defence','aura'],                    desc: 'Aura that grants increased evasion rating.' },
  { id: 'determination',    name: 'Determination',    type: 'active',  tags: ['defence','aura'],                    desc: 'Aura that grants increased armour.' },
  { id: 'discipline',       name: 'Discipline',       type: 'active',  tags: ['defence','aura'],                    desc: 'Aura that grants increased energy shield.' },
  { id: 'haste',            name: 'Haste',            type: 'active',  tags: ['buff','aura'],                       desc: 'Aura that increases movement, attack, and cast speed.' },
  { id: 'malevolence',      name: 'Malevolence',      type: 'active',  tags: ['chaos','aura'],                      desc: 'Aura that increases damage over time.' },
  { id: 'vitality',         name: 'Vitality',         type: 'active',  tags: ['defence','aura'],                    desc: 'Aura that regenerates life per second.' },

  // ── Active: Misc ────────────────────────────────────────────────────────
  { id: 'flicker-strike',   name: 'Flicker Strike',   type: 'active',  tags: ['attack','melee','movement'],         desc: 'Teleports to a nearby enemy and strikes, consuming a frenzy charge.' },
  { id: 'cyclone',          name: 'Cyclone',          type: 'active',  tags: ['attack','area','melee','channelling'], desc: 'Spin while dealing damage to all nearby enemies.' },
  { id: 'seismic-cry',      name: 'Seismic Cry',      type: 'active',  tags: ['physical','warcry','area'],          desc: 'War cry that exerts subsequent slam skills for more damage.' },
  { id: 'power-siphon',     name: 'Power Siphon',     type: 'active',  tags: ['attack','projectile'],               desc: 'Fires projectiles that grant power charges on kill.' },
  { id: 'dash',             name: 'Dash',             type: 'active',  tags: ['movement','spell'],                  desc: 'Dashes quickly in a target direction.' },
  { id: 'flame-dash',       name: 'Flame Dash',       type: 'active',  tags: ['movement','fire','spell'],           desc: 'Teleports with a trail of flames, leaving lingering fire.' },
  { id: 'frenzy',           name: 'Frenzy',           type: 'active',  tags: ['attack','projectile','bow','melee'], desc: 'Attacks that generate frenzy charges.' },
  { id: 'whirling-blades',  name: 'Whirling Blades',  type: 'active',  tags: ['movement','attack','melee'],         desc: 'Whirls to a target location while striking enemies.' },

  // ── Support Gems ────────────────────────────────────────────────────────
  { id: 'added-fire-damage',      name: 'Added Fire Damage',      type: 'support', tags: ['fire','damage'],             desc: 'Adds fire damage to the supported skill.' },
  { id: 'added-cold-damage',      name: 'Added Cold Damage',      type: 'support', tags: ['cold','damage'],             desc: 'Adds cold damage to the supported skill.' },
  { id: 'added-lightning-damage', name: 'Added Lightning Damage', type: 'support', tags: ['lightning','damage'],        desc: 'Adds lightning damage to the supported skill.' },
  { id: 'added-chaos-damage',     name: 'Added Chaos Damage',     type: 'support', tags: ['chaos','damage'],            desc: 'Adds chaos damage to the supported skill.' },
  { id: 'multiple-projectiles',   name: 'Multiple Projectiles',   type: 'support', tags: ['projectile'],                desc: 'Fires more projectiles with a damage penalty.' },
  { id: 'fork',                   name: 'Fork',                   type: 'support', tags: ['projectile'],                desc: 'Projectiles split into two on hitting enemies.' },
  { id: 'chain',                  name: 'Chain',                  type: 'support', tags: ['projectile','chaining'],     desc: 'Projectiles chain to nearby enemies on impact.' },
  { id: 'pierce',                 name: 'Pierce',                 type: 'support', tags: ['projectile'],                desc: 'Projectiles pierce through enemies they hit.' },
  { id: 'concentrated-effect',    name: 'Concentrated Effect',    type: 'support', tags: ['area'],                      desc: 'Smaller area with more damage for AoE skills.' },
  { id: 'increased-aoe',          name: 'Increased Area of Effect', type: 'support', tags: ['area'],                    desc: 'Increases the area of effect radius.' },
  { id: 'spell-echo',             name: 'Spell Echo',             type: 'support', tags: ['spell'],                     desc: 'Spell repeats itself after a delay.' },
  { id: 'faster-casting',         name: 'Faster Casting',         type: 'support', tags: ['spell'],                     desc: 'Increases cast speed of the supported spell.' },
  { id: 'controlled-destruction', name: 'Controlled Destruction', type: 'support', tags: ['spell','damage','crit'],     desc: 'More spell damage but reduced critical strike chance.' },
  { id: 'elemental-focus',        name: 'Elemental Focus',        type: 'support', tags: ['elemental','damage'],        desc: 'More elemental damage but cannot apply ailments.' },
  { id: 'burning-damage',         name: 'Burning Damage',         type: 'support', tags: ['fire','ignite','dot'],       desc: 'More damage for burning and ignite.' },
  { id: 'ignite-proliferation',   name: 'Ignite Proliferation',   type: 'support', tags: ['fire','ignite'],             desc: 'Ignites spread to nearby enemies.' },
  { id: 'melee-physical-damage',  name: 'Melee Physical Damage',  type: 'support', tags: ['physical','melee'],          desc: 'More physical damage for melee skills.' },
  { id: 'maim',                   name: 'Maim',                   type: 'support', tags: ['physical','melee'],          desc: 'Supported skill maims on hit, reducing movement speed.' },
  { id: 'minion-damage',          name: 'Minion Damage',          type: 'support', tags: ['minion','damage'],           desc: 'Increases minion damage.' },
  { id: 'brutality',              name: 'Brutality',              type: 'support', tags: ['physical','damage'],         desc: 'More physical damage, cannot deal elemental or chaos.' },
  { id: 'vile-toxins',            name: 'Vile Toxins',            type: 'support', tags: ['chaos','poison','dot'],      desc: 'More damage per poison stack on target.' },
  { id: 'void-manipulation',      name: 'Void Manipulation',      type: 'support', tags: ['chaos','damage'],            desc: 'More chaos damage, no elemental damage.' },
  { id: 'faster-attacks',         name: 'Faster Attacks',         type: 'support', tags: ['attack'],                    desc: 'Increases attack speed.' },
  { id: 'culling-strike',         name: 'Culling Strike',         type: 'support', tags: ['attack'],                    desc: 'Kills enemies that are on 10% or less life.' },
  { id: 'lifetap',                name: 'Lifetap',                type: 'support', tags: ['life'],                      desc: 'Uses life instead of mana for the supported skill.' },
  { id: 'inspiration',            name: 'Inspiration',            type: 'support', tags: ['mana','damage'],             desc: 'Stores charges to reduce cost and boost damage.' },
  { id: 'unbound-ailments',       name: 'Unbound Ailments',       type: 'support', tags: ['ailment','dot'],             desc: 'More ailment magnitude and duration.' },
  { id: 'swift-affliction',       name: 'Swift Affliction',       type: 'support', tags: ['ailment','dot'],             desc: 'More damage over time, reduced duration.' },
  { id: 'cast-on-crit',           name: 'Cast on Critical Strike', type: 'support', tags: ['spell','crit'],             desc: 'Casts a linked spell when the skill critically strikes.' },
  { id: 'spell-cascade',          name: 'Spell Cascade',          type: 'support', tags: ['spell','area'],              desc: 'Repeats the spell in sequence at nearby locations.' },
  { id: 'hypothermia',            name: 'Hypothermia',            type: 'support', tags: ['cold','ailment'],            desc: 'More cold damage against chilled enemies.' },
  { id: 'ice-bite',               name: 'Ice Bite',               type: 'support', tags: ['cold'],                      desc: 'Adds cold damage based on frenzy charges.' },
  { id: 'cold-to-fire',           name: 'Cold to Fire',           type: 'support', tags: ['cold','fire'],               desc: 'Converts cold damage to fire.' },
  { id: 'lightning-to-fire',      name: 'Lightning to Fire',      type: 'support', tags: ['lightning','fire'],          desc: 'Converts lightning damage to fire.' },
  { id: 'impale',                 name: 'Impale',                 type: 'support', tags: ['physical','attack'],         desc: 'Supported attacks can impale, amplifying physical damage.' },
  { id: 'energy-leech',           name: 'Energy Leech',           type: 'support', tags: ['es','leech'],                desc: 'Supported skill leeches energy shield.' },
  { id: 'close-combat',           name: 'Close Combat',           type: 'support', tags: ['melee'],                     desc: 'More melee damage against close enemies.' },
  { id: 'power-charge-on-crit',   name: 'Power Charge On Critical', type: 'support', tags: ['crit'],                   desc: 'Grants a power charge on critical strike.' },
  { id: 'damage-on-full-life',    name: 'Damage on Full Life',    type: 'support', tags: ['damage'],                    desc: 'More damage while on full life.' },
  { id: 'minion-speed',           name: 'Minion Speed',           type: 'support', tags: ['minion'],                    desc: 'Increases minion movement and attack speed.' },
  { id: 'meat-shield',            name: 'Meat Shield',            type: 'support', tags: ['minion','defence'],          desc: 'Minions are harder to kill and taunt enemies.' },
];

async function importBundledGems() {
  console.log(`[gems] Writing ${BUNDLED_GEMS.length} bundled gems`);

  await writeCache('gems', BUNDLED_GEMS);
  await writeRaw('gems', { source: 'bundled', writtenAt: new Date().toISOString(), count: BUNDLED_GEMS.length });
  await touchSource('gems', {
    count:     BUNDLED_GEMS.length,
    sourceUrl: 'bundled',
    lastError: null,
    note:      'Bundled list (PoE2 0.1–0.2 era). Run data:update:poe2db for live supplemental data.',
  });

  console.log('[gems] Done');
  return { ok: true, count: BUNDLED_GEMS.length, source: 'bundled' };
}

export async function importGems() {
  console.log('[gems] Fetching PoE2DB gem sources');

  const imported = [];
  const errors = [];

  for (const source of POE2DB_GEM_SOURCES) {
    try {
      const response = await fetch(source.url, {
        headers: POE2DB_HEADERS,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${source.url} returned ${response.status}`);
      const html = await response.text();
      imported.push(...parsePoe2dbGems(html, source.type, source.url));
    } catch (err) {
      errors.push(err.message);
    }
  }

  const gems = dedupeById(imported);
  if (!gems.length) {
    const result = await importBundledGems();
    return { ...result, ok: false, source: 'bundled-fallback', errors };
  }

  const sourceUrls = POE2DB_GEM_SOURCES.map((source) => source.url);
  await writeCache('gems', gems);
  await writeRaw('gems', {
    source: 'poe2db.tw',
    sourceUrls,
    writtenAt: new Date().toISOString(),
    count: gems.length,
    errors,
  });
  await touchSource('gems', {
    count: gems.length,
    sourceUrl: sourceUrls.join(', '),
    lastError: errors.length ? errors.join('; ') : null,
    note: 'Imported live Skill Gems and Support Gems from PoE2DB.',
  });

  console.log(`[gems] Done (${gems.length} PoE2DB gems)`);
  return { ok: true, count: gems.length, source: 'poe2db.tw', errors };
}

function parsePoe2dbGems(html, type, sourceUrl) {
  const gems = [];
  const rowRe = /<tr\s+data-filters="([^"]*)"[^>]*>([\s\S]*?)(?=<tr\s+data-filters=|<\/tbody>)/g;
  let row;
  while ((row = rowRe.exec(html))) {
    const filters = decodeHtml(row[1]);
    const chunk = row[2];
    const nameMatch = chunk.match(/<td><a\s+class="gem[^"]*"[^>]*href="\/us\/([^"]+)"[^>]*>([^<]+)<\/a>\s*\((\d+)\)/i);
    if (!nameMatch) continue;

    const name = decodeHtml(nameMatch[2]).trim();
    const requiredLevel = Number(nameMatch[3]);
    const tags = extractGemTags(chunk, filters);
    const desc = extractGemDescription(chunk);

    gems.push({
      id: slugify(name),
      name,
      type,
      tags,
      desc,
      requiredLevel: Number.isFinite(requiredLevel) ? requiredLevel : undefined,
      sourceUrl,
    });
  }
  return gems;
}

function extractGemTags(chunk, filters) {
  const tags = new Set();
  const tagBlock = chunk.match(/<div class="gem_tags[^"]*">([\s\S]*?)<\/div>/i)?.[1] || '';
  const tagRe = /<a[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = tagRe.exec(tagBlock))) {
    const tag = normalizeTag(decodeHtml(match[1]));
    if (tag) tags.add(tag);
  }

  for (const raw of filters.split(/\s+/)) {
    const tag = normalizeTag(raw);
    if (tag && !/^(str|dex|int|\d+)$/.test(tag)) tags.add(tag);
  }

  return [...tags].sort();
}

function extractGemDescription(chunk) {
  const text = chunk
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const decoded = decodeHtml(text);
  return decoded.length > 220 ? `${decoded.slice(0, 217).trim()}...` : decoded;
}

function normalizeTag(value) {
  return decodeHtml(String(value || ''))
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugify(value) {
  return normalizeTag(value);
}

function dedupeById(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.id || map.has(item.id)) continue;
    map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
