'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const CLASS_META = {
  Warrior:   { letter: 'W', hue: '#c0392b' },
  Ranger:    { letter: 'R', hue: '#27ae60' },
  Sorceress: { letter: 'S', hue: '#2980b9' },
  Witch:     { letter: 'W', hue: '#8e44ad' },
  Monk:      { letter: 'M', hue: '#e67e22' },
  Mercenary: { letter: 'G', hue: '#7f8c8d' },
  Huntress:  { letter: 'H', hue: '#1abc9c' },
  Druid:     { letter: 'D', hue: '#2ecc71' },
};

const SLOT_DISPLAY = {
  Weapon:     'Main Hand',
  Offhand:    'Off-Hand',
  Weapon2:    'Main Hand ②',
  Offhand2:   'Off-Hand ②',
  Helm:       'Helmet',
  BodyArmour: 'Body Armour',
  Gloves:     'Gloves',
  Boots:      'Boots',
  Belt:       'Belt',
  Amulet:     'Amulet',
  Ring:       'Ring (L)',
  Ring2:      'Ring (R)',
  Flask1:     'Flask 1',
  Flask2:     'Flask 2',
  Flask3:     'Flask 3',
  Flask4:     'Flask 4',
  Flask5:     'Flask 5',
};

const SOURCE_TAG_CLASS = {
  maxroll:    'green',
  mobalytics: 'blue',
  pobbin:     'amber',
  poeninja:   'amber',
};

const EXAMPLE_URL = 'https://maxroll.gg/poe2/planner/7n9o0um4';

// ── Crafting data (loaded dynamically from /api/data/crafting/data) ─────────
let CRAFTING_ITEM_BASES = [];
let CRAFTING_MODIFIERS = [];
let CRAFTING_ESSENCES = [];
let CRAFTING_OMENS = [];
let CRAFTING_RUNES = [];
let CRAFTING_SOUL_CORES = [];
let CRAFTING_ABYSS_DATA = [];
let CRAFTING_DESECRATION_DATA = [];
let CRAFTING_QUALITY_DATA = [];
let CRAFTING_CORRUPTION_DATA = [];
let CRAFTING_SOCKET_CRAFTING_DATA = [];
let CRAFTING_MECHANICS = [];
let craftingDataLoaded = false;
let craftingDataError = null;

async function loadCraftingData() {
  if (craftingDataLoaded) return true;
  try {
    const res = await fetch('/api/data/crafting/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to load crafting data');
    CRAFTING_ITEM_BASES = data.bases ?? [];
    CRAFTING_MODIFIERS = data.modifiers ?? [];
    CRAFTING_ESSENCES = data.essences ?? [];
    CRAFTING_OMENS = data.omens ?? [];
    CRAFTING_RUNES = data.runes ?? [];
    CRAFTING_SOUL_CORES = data.soulCores ?? [];
    CRAFTING_ABYSS_DATA = data.abyssData ?? [];
    CRAFTING_DESECRATION_DATA = data.desecrationData ?? [];
    CRAFTING_QUALITY_DATA = data.qualityData ?? [];
    CRAFTING_CORRUPTION_DATA = data.corruptionData ?? [];
    CRAFTING_SOCKET_CRAFTING_DATA = data.socketCraftingData ?? [];
    CRAFTING_MECHANICS = data.craftingMechanics ?? [];
    craftingDataLoaded = true;
    return true;
  } catch (err) {
    craftingDataError = err.message;
    return false;
  }
}

// ── State ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

let lastBuild      = null;
let lastData       = null;
let lastBuildRaw   = '';
let lastImportedBuildRaw = '';
let lastFilename   = 'MyBuild.build';
let selectedKind   = 'auto';
let inspectedInput = null;
let availableSets  = null;
let craftingState  = null;

// ── Tab management ─────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Crafting Simulator is now a standalone page (/crafting.html)

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === name)
  );
  document.querySelectorAll('.tab-panel').forEach((p) =>
    p.classList.toggle('active', p.id === `tab-${name}`)
  );
  if (name === 'tree') {
    onTreeTabActive();
  }
}

// ── Drag & drop ────────────────────────────────────────────────────────────
(function initDragDrop() {
  const zone    = $('drop-zone');
  const inputEl = $('input');
  if (!zone || !inputEl) return;

  ['dragenter', 'dragover'].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag-over'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    zone.addEventListener(ev, () => zone.classList.remove('drag-over'))
  );

  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      inputEl.value = text;
      inputEl.dispatchEvent(new Event('input'));
      convert();
    } catch {
      setStatus('Could not read file.', 'error');
    }
  });
})();

// ── Input events ───────────────────────────────────────────────────────────
$('input')?.addEventListener('input', () => {
  inspectedInput = null;
  availableSets  = null;
  $('set-selector')?.classList.add('hidden');
});

$('input')?.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') convert();
});

['sel-gems', 'sel-gear', 'sel-tree'].forEach((id) =>
  $(id)?.addEventListener('change', () => doConvert())
);

$('convert-btn')?.addEventListener('click', convert);
$('download')?.addEventListener('click', download);
$('copy')?.addEventListener('click', copyJson);

$('example-btn')?.addEventListener('click', () => {
  $('input').value = EXAMPLE_URL;
  $('input').dispatchEvent(new Event('input'));
  convert();
});

// JSON editor
$('json')?.addEventListener('input', onJsonEdit);
$('json-format')?.addEventListener('click', formatJson);
$('json-reset')?.addEventListener('click', resetJson);
$('json-apply')?.addEventListener('click', applyJsonToPreview);

// Quality banner dismiss
$('quality-banner-close')?.addEventListener('click', () => {
  $('quality-banner')?.classList.add('hidden');
});

// ── Shareable URL ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('poe2ai_load_generated') === 'true') {
    localStorage.removeItem('poe2ai_load_generated');
    try {
      const raw = localStorage.getItem('poe2ai_lastbuild');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.build) {
          lastBuild = data.build;
          lastData = data;
          renderResults(data);
          setStatus('Loaded generated AI build plan into planner.', 'ok');
        }
      }
    } catch (e) {
      console.error('Failed to load generated AI build:', e);
    }
    return;
  }

  const hash = location.hash;
  if (hash && hash.length > 1 && $('input')) {
    const input = decodeShareHash(hash);
    if (input) {
      $('input').value = input;
      convert();
    }
  }
});

function encodeShareHash(input) {
  try {
    const bytes  = new TextEncoder().encode(input);
    const binary = String.fromCharCode(...bytes);
    return '#' + btoa(binary);
  } catch { return ''; }
}

function decodeShareHash(hash) {
  if (!hash || hash.length < 2) return '';
  try {
    const binary = atob(hash.slice(1));
    const bytes  = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
}

// ── Conversion flow ────────────────────────────────────────────────────────
async function convert() {
  const input = $('input').value.trim();
  if (!input) { setStatus('Paste a PoB code or URL first.', 'error'); return; }
  if (inspectedInput !== input) await inspect(input);
  await doConvert();
}

async function inspect(input) {
  setStatus('Inspecting…', '');
  $('convert-btn').disabled = true;
  try {
    const res  = await fetch('/api/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, kind: selectedKind }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return;
    inspectedInput = input;
    availableSets  = { skillSets: data.skillSets, itemSets: data.itemSets, treeSpecs: data.treeSpecs };
    renderSetSelectors(availableSets);
  } catch { /* non-fatal */ } finally {
    $('convert-btn').disabled = false;
  }
}

async function doConvert() {
  const input = $('input').value.trim();
  if (!input) return;

  setStatus('Converting…', '');
  $('convert-btn').disabled = true;
  $('quality-banner')?.classList.add('hidden');

  const skillSetId = parseSelValue($('sel-gems')?.value);
  const itemSetId  = parseSelValue($('sel-gear')?.value);
  const specIndex  = parseSelValue($('sel-tree')?.value);

  try {
    const res  = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        kind:        selectedKind,
        name:        $('name').value.trim()        || undefined,
        description: $('description').value.trim() || undefined,
        skillSetId, itemSetId, specIndex,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);

    lastBuild    = data.build;
    lastData     = data;
    lastFilename = data.filename || 'MyBuild.build';

    renderResults(data);
    setStatus(`✅ ${lastFilename}`, 'ok');

    // Persist last build for the optional AI feature (local only, no server)
    try {
      localStorage.setItem('poe2ai_lastbuild', JSON.stringify({
        build: data.build,
        report: data.report,
        source: data.source,
      }));
    } catch { /* localStorage unavailable — non-fatal */ }

    // Encode input into URL hash for sharing
    const hash = encodeShareHash(input);
    if (hash) history.replaceState(null, '', hash);
  } catch (err) {
    setStatus(err.message, 'error');
    $('results').classList.add('hidden');
  } finally {
    $('convert-btn').disabled = false;
  }
}

// ── Results rendering ──────────────────────────────────────────────────────
function renderResults(data) {
  const { build: b, report: r, source, passiveNames = {}, passiveAscendancies = {}, ascendancyNames = {} } = data;
  normalizeBuildGemLevels(b);
  const splitPassives = splitAscendancyPassives(b.passives ?? [], passiveAscendancies);

  // Stat cards
  $('stat-converted').textContent   = r.converted.length;
  $('stat-guessed').textContent     = r.guessed.length;
  $('stat-unsupported').textContent = r.unsupported.length;
  $('stat-source').textContent      = source?.kind ?? '—';

  renderOverviewTab(b, r, source, data.preview?.meta, ascendancyNames);
  renderPreviewTab(b, r, source, data.preview?.meta, passiveNames, passiveAscendancies, ascendancyNames);
  renderEditableSkills(b.skills ?? []);
  renderEditablePassives(splitPassives.regular, r, passiveNames);
  renderEditablePassives(splitPassives.ascendancy, r, passiveNames, 'tab-ascendancy', { title: 'Ascendancy Points', hideBuildOptions: true });
  renderEditableItems(b.items ?? []);
  renderCraftingSimulator();
  renderProblemsTab(r);
  setupAllocatedTree(b);

  // JSON tab — editable textarea
  lastImportedBuildRaw = JSON.stringify(b, null, 2);
  syncJsonEditorFromBuild(true);

  // Problems badge
  const issues = r.guessed.length + r.unsupported.length + getCraftingWarnings().length;
  const badge  = $('problems-badge');
  badge.textContent = issues;
  badge.classList.toggle('hidden', issues === 0);

  $('download').disabled = false;
  $('results').classList.remove('hidden');
  switchTab('overview');
  $('quality-banner')?.classList.add('hidden');
}

// ── Quality warnings ───────────────────────────────────────────────────────
function showQualityWarnings(build, report) {
  const banner = $('quality-banner');
  const msg    = $('quality-banner-msg');
  if (!banner || !msg) return;

  // Use server-authoritative warnings; add a client-side note for many unsupported entries
  const issues = (report.warnings ?? [])
    .map((w) => w.replace(/\.$/, ''));

  if (report.unsupported.length > 3) {
    issues.push(`${report.unsupported.length} unsupported entries`);
  }

  if (issues.length) {
    msg.textContent = 'Heads up — ' + issues.join(' · ');
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// ── Overview ───────────────────────────────────────────────────────────────
function renderOverviewTab(build, report, source, meta = {}, ascendancyNames = {}) {
  const ascLine    = report.converted.find((l) => l.startsWith('ascendancy'));
  const ascMatch   = ascLine?.match(/^ascendancy "([^"]+)"/);
  const ascDisplay = ascendancyDisplayName(ascMatch?.[1] || build.ascendancy || '', ascendancyNames);
  const className  = meta?.className ?? '';

  const sourceTagClass = SOURCE_TAG_CLASS[source?.kind] || '';
  const tags = [
    ascDisplay && `<span class="tag amber">${esc(ascDisplay)}</span>`,
    source?.kind && `<span class="tag ${sourceTagClass}">${esc(source.kind)}</span>`,
  ].filter(Boolean).join('');

  // Class avatar
  const classInfo = CLASS_META[className];
  const avatar = classInfo
    ? `<div class="class-avatar" style="background:${classInfo.hue}">${classInfo.letter}</div>`
    : '';

  const skills  = (build.skills  ?? []).length;
  const passive = (build.passives ?? []).length;
  const items   = (build.items   ?? []).length;
  const issues  = report.guessed.length + report.unsupported.length;

  $('tab-overview').innerHTML = `
    <div class="ov-header">
      <div class="ov-title-row">
        ${avatar}
        <h2 class="ov-name">${esc(build.name ?? 'Imported Build')}</h2>
      </div>
      <div class="ov-tags">${tags}</div>
    </div>
    <div class="ov-grid">
      <div class="ov-card"><div class="ov-num">${skills}</div><div class="ov-card-label">Skill Groups</div></div>
      <div class="ov-card"><div class="ov-num">${passive}</div><div class="ov-card-label">Passives</div></div>
      <div class="ov-card"><div class="ov-num">${items}</div><div class="ov-card-label">Items</div></div>
      <div class="ov-card"><div class="ov-num green">${report.converted.length}</div><div class="ov-card-label">Converted</div></div>
      <div class="ov-card"><div class="ov-num amber">${report.guessed.length}</div><div class="ov-card-label">Guessed</div></div>
      <div class="ov-card"><div class="ov-num ${issues ? 'red' : ''}">${issues}</div><div class="ov-card-label">Issues</div></div>
    </div>
    ${build.description
      ? `<div class="ov-desc">${esc(build.description).replace(/\n/g, '<br>')}</div>`
      : ''}
  `;
}

// ── Skills ─────────────────────────────────────────────────────────────────
function renderEditableSkills(skills, targetId = 'tab-skills') {
  const copyBtn = `<button class="section-copy-btn ghost sm" onclick="copySection('skills')">Copy JSON</button>`;
  const addBtn = `<button class="section-copy-btn ghost sm" onclick="addSkill()">Add Skill</button>`;

  if (!skills.length) {
    $(targetId).innerHTML =
      `<div class="tab-section-header">${copyBtn}${addBtn}</div><p class="empty-msg">No skills found in this build.</p>`;
    return;
  }

  const html = skills.map((skill, skillIndex) => {
    const normalizedSkill = normalizeBuildSkill(skill);
    const skillMeta = parseGemAdditionalText(normalizedSkill.additional_text);
    const supportsHtml = normalizedSkill.support_skills.map((support, supportIndex) => {
      const supportMeta = parseGemAdditionalText(support.additional_text);
      const supportName = gemName(support.id || `Support ${supportIndex + 1}`);
      return `
      <div class="edit-subcard">
        <div class="edit-card-head">
          <div>
            <div class="edit-card-title">${esc(supportName)}</div>
            <div class="edit-card-subtitle">Support ${supportIndex + 1}</div>
          </div>
          <button class="ghost sm" type="button" onclick="removeSkillSupport(${skillIndex}, ${supportIndex})">Remove</button>
        </div>
        <div class="edit-grid">
          <label class="edit-field edit-field-wide">
            <span class="edit-label">Gem</span>
            <input class="readonly-input" type="text" value="${escAttr(supportName)}" readonly />
          </label>
          <label class="edit-field">
            <span class="edit-label">Build Level Range</span>
            <input type="text" value="${escAttr(formatLevelInterval(support.level_interval))}" onchange="updateSkillSupportField(${skillIndex}, ${supportIndex}, 'level_interval', this.value)" />
          </label>
          <label class="edit-field">
            <span class="edit-label">Gem Level</span>
            <select onchange="updateSkillSupportField(${skillIndex}, ${supportIndex}, 'gem_level', this.value)">${gemLevelOptions(support.id, supportMeta.level, 'support')}</select>
          </label>
          <label class="edit-field">
            <span class="edit-label">Quality %</span>
            <input type="number" min="0" max="100" step="1" value="${escAttr(supportMeta.quality)}" onchange="updateSkillSupportField(${skillIndex}, ${supportIndex}, 'gem_quality', this.value)" />
          </label>
          <label class="edit-field edit-field-full">
            <span class="edit-label">Notes</span>
            <textarea rows="2" onchange="updateSkillSupportField(${skillIndex}, ${supportIndex}, 'gem_notes', this.value)">${esc(supportMeta.notes)}</textarea>
          </label>
          <details class="advanced-id edit-field edit-field-full">
            <summary>Advanced id</summary>
            <input type="text" value="${escAttr(support.id ?? '')}" onchange="updateSkillSupportField(${skillIndex}, ${supportIndex}, 'id', this.value)" />
          </details>
        </div>
      </div>
    `;
    }).join('');

    return `
      <li class="gem-group">
        <details class="edit-card skill-details" open>
          <summary class="edit-card-head skill-summary">
            <div>
              <div class="edit-card-title">${esc(gemName(normalizedSkill.id || 'New Skill'))}</div>
              <div class="edit-card-subtitle">${normalizedSkill.support_skills.length} supports</div>
            </div>
            <div class="edit-card-actions" onclick="event.stopPropagation()">
              <button class="ghost sm" type="button" onclick="event.preventDefault(); event.stopPropagation(); addSkillSupport(${skillIndex})">Add Support</button>
              <button class="ghost sm" type="button" onclick="event.preventDefault(); event.stopPropagation(); removeSkill(${skillIndex})">Remove</button>
            </div>
          </summary>
          <div class="skill-details-body">
            <div class="edit-grid">
              <label class="edit-field edit-field-wide">
                <span class="edit-label">Gem</span>
                <input class="readonly-input" type="text" value="${escAttr(gemName(normalizedSkill.id || 'New Skill'))}" readonly />
              </label>
              <label class="edit-field">
                <span class="edit-label">Build Level Range</span>
                <input type="text" value="${escAttr(formatLevelInterval(normalizedSkill.level_interval))}" onchange="updateSkillField(${skillIndex}, 'level_interval', this.value)" />
              </label>
              <label class="edit-field">
                <span class="edit-label">Gem Level</span>
                <select onchange="updateSkillField(${skillIndex}, 'gem_level', this.value)">${gemLevelOptions(normalizedSkill.id, skillMeta.level, 'skill')}</select>
              </label>
              <label class="edit-field">
                <span class="edit-label">Quality %</span>
                <input type="number" min="0" max="100" step="1" value="${escAttr(skillMeta.quality)}" onchange="updateSkillField(${skillIndex}, 'gem_quality', this.value)" />
              </label>
              <label class="edit-field edit-field-full">
                <span class="edit-label">Notes</span>
                <textarea rows="2" onchange="updateSkillField(${skillIndex}, 'gem_notes', this.value)">${esc(skillMeta.notes)}</textarea>
              </label>
              <details class="advanced-id edit-field edit-field-full">
                <summary>Advanced id</summary>
                <input type="text" value="${escAttr(normalizedSkill.id ?? '')}" onchange="updateSkillField(${skillIndex}, 'id', this.value)" />
              </details>
            </div>
            <details class="support-details">
              <summary class="support-summary">Supports (${normalizedSkill.support_skills.length})</summary>
              <div class="edit-subcards">${supportsHtml || '<div class="empty-msg tight">No supports yet.</div>'}</div>
            </details>
          </div>
        </details>
      </li>`;
  }).join('');

  $(targetId).innerHTML =
    `<div class="tab-section-header">${copyBtn}${addBtn}</div><ul class="gem-list">${html}</ul>`;
}

// ── Passives ───────────────────────────────────────────────────────────────
function renderEditablePassives(passives, report, passiveNames = {}, targetId = 'tab-passives', options = {}) {
  const entries      = passives.map((entry, fallbackIndex) => normalizePassiveEntry(entry, fallbackIndex));
  const values       = entries.map((entry) => entry.passive);
  const total        = values.length;
  const showBuildOptions = !options.hideBuildOptions;
  const withInterval = showBuildOptions ? values.filter((p) => typeof p === 'object' && p.level_interval).length : 0;
  const weaponSet1   = showBuildOptions ? values.filter((p) => getWeaponSet(p) === 1) : [];
  const weaponSet2   = showBuildOptions ? values.filter((p) => getWeaponSet(p) === 2) : [];

  const line       = report.guessed.find((l) => /passive node/i.test(l));
  const unresolved = line ? (parseInt(line.match(/(\d+)/)?.[1] ?? '0', 10)) : 0;

  const copyBtn = `<button class="section-copy-btn ghost sm" onclick="copySection('passives')">Copy JSON</button>`;
  const addBtn  = `<button class="section-copy-btn ghost sm" onclick="addPassive()">Add Passive</button>`;

  $(targetId).innerHTML = `
    <div class="tab-section-header">${copyBtn}${addBtn}</div>
    ${options.title ? `<h3 class="tab-subtitle">${esc(options.title)}</h3>` : ''}
    <div class="passives-summary">
      <div class="pass-block">
        <span class="pass-num green">${total}</span>
        <span class="pass-label">Resolved nodes</span>
      </div>
      ${unresolved ? `
        <div class="pass-block">
          <span class="pass-num amber">${unresolved}</span>
          <span class="pass-label">Unresolved</span>
        </div>` : ''}
      ${withInterval ? `
        <div class="pass-block">
          <span class="pass-num">${withInterval}</span>
          <span class="pass-label">With level interval</span>
        </div>` : ''}
      ${(weaponSet1.length || weaponSet2.length) ? `
        <div class="pass-block">
          <span class="pass-num">${weaponSet1.length + weaponSet2.length}</span>
          <span class="pass-label">Weapon Set Nodes</span>
        </div>` : ''}
    </div>
    ${entries.length ? `<div class="passives-sections editable-passives">
      ${entries.map((entry) => renderEditablePassive(entry.passive, entry.index, passiveNames, options)).join('')}
    </div>` : ''}
  `;
}

function normalizePassiveEntry(entry, fallbackIndex) {
  if (entry && typeof entry === 'object' && Object.hasOwn(entry, 'passive') && Object.hasOwn(entry, 'index')) {
    return entry;
  }
  return { passive: entry, index: fallbackIndex };
}

function renderEditablePassive(passive, index, passiveNames = {}, options = {}) {
  const normalized = normalizePassive(passive);
  const displayName = passiveNames[normalized.id] || formatPassiveId(normalized.id);
  const showBuildOptions = !options.hideBuildOptions;
  return `
    <div class="passive-section edit-card">
      <div class="edit-card-head">
        <div class="edit-card-title">${esc(displayName || `Passive ${index + 1}`)}</div>
        <button class="ghost sm" type="button" onclick="removePassive(${index})">Remove</button>
      </div>
      <div class="edit-grid">
        <label class="edit-field edit-field-wide">
          <span class="edit-label">Passive Id</span>
          <input type="text" value="${escAttr(normalized.id ?? '')}" onchange="updatePassiveField(${index}, 'id', this.value)" />
        </label>
        ${showBuildOptions ? renderLevelIntervalControls(normalized.levelInterval, 'updatePassiveLevelIntervalPart', index) : ''}
        ${showBuildOptions ? `
          <label class="edit-field">
            <span class="edit-label">Weapon Set</span>
            <select onchange="updatePassiveField(${index}, 'weapon_set', this.value)">
              ${weaponSetOptions(normalized.weaponSet)}
            </select>
          </label>` : ''}
        <label class="edit-field edit-field-full">
          <span class="edit-label">Hover Text</span>
          <textarea rows="2" onchange="updatePassiveField(${index}, 'additional_text', this.value)">${esc(normalized.additional_text ?? '')}</textarea>
        </label>
      </div>
      ${showBuildOptions && normalized.levelInterval ? renderPassiveBar(normalized.levelInterval) : ''}
    </div>`;
}

function weaponSetOptions(selectedValue) {
  const selected = selectedValue === 1 || selectedValue === 2 ? String(selectedValue) : '';
  return ['', '1', '2']
    .map((value) => `<option value="${value}"${value === selected ? ' selected' : ''}>${value || 'None'}</option>`)
    .join('');
}

function renderPassiveBar(levelInterval) {
  if (!levelInterval) return '';
  const [start, end] = levelInterval;
  const leftPct  = Math.round(start);
  const widthPct = Math.max(2, Math.round(end - start));
  const zone     = start < 40 ? 'bar-early' : start < 70 ? 'bar-mid' : 'bar-late';
  return `<div class="passive-bar">
    <div class="passive-bar-fill ${zone}" style="left:${leftPct}%;width:${widthPct}%"></div>
  </div>`;
}

// ── Items ──────────────────────────────────────────────────────────────────
function renderEditableItems(items, targetId = 'tab-items') {
  const copyBtn = `<button class="section-copy-btn ghost sm" onclick="copySection('items')">Copy JSON</button>`;
  const addBtn  = `<button class="section-copy-btn ghost sm" onclick="addItem()">Add Item</button>`;

  if (!items.length) {
    $(targetId).innerHTML =
      `<div class="tab-section-header">${copyBtn}${addBtn}</div><p class="empty-msg">No items found in this build.</p>`;
    return;
  }

  const rows = items.map((item, index) => {
    const slotLabel = prettySlot(item.inventory_id);
    return `<div class="passive-section edit-card">
      <div class="edit-card-head">
        <div class="edit-card-title">${esc(slotLabel || `Item ${index + 1}`)}</div>
        <button class="ghost sm" type="button" onclick="removeItem(${index})">Remove</button>
      </div>
      <div class="edit-grid">
        <label class="edit-field">
          <span class="edit-label">Slot</span>
          <input type="text" value="${escAttr(item.inventory_id ?? '')}" onchange="updateItemField(${index}, 'inventory_id', this.value)" />
        </label>
        ${renderLevelIntervalControls(item.level_interval, 'updateItemLevelIntervalPart', index)}
        <label class="edit-field edit-field-wide">
          <span class="edit-label">Unique Name</span>
          <input type="text" value="${escAttr(item.unique_name ?? '')}" onchange="updateItemField(${index}, 'unique_name', this.value)" />
        </label>
        <label class="edit-field edit-field-full">
          <span class="edit-label">Hover Text</span>
          <textarea rows="5" onchange="updateItemField(${index}, 'additional_text', this.value)">${esc(item.additional_text ?? '')}</textarea>
        </label>
      </div>
    </div>`;
  }).join('');

  $(targetId).innerHTML = `
    <div class="tab-section-header">${copyBtn}${addBtn}</div>
    <div class="passives-sections editable-items">${rows}</div>`;
}

// ── Problems ───────────────────────────────────────────────────────────────
function renderPreviewTab(build, report, source, meta = {}, passiveNames = {}, passiveAscendancies = {}, ascendancyNames = {}) {
  const splitPassives = splitAscendancyPassives(build.passives ?? [], passiveAscendancies);
  $('tab-preview').innerHTML = `
    <div class="edit-grid edit-grid-overview">
      <label class="edit-field">
        <span class="edit-label">Build Name</span>
        <input type="text" value="${escAttr(build.name ?? '')}" onchange="updateBuildRootField('name', this.value)" />
      </label>
      <label class="edit-field">
        <span class="edit-label">Ascendancy</span>
        ${renderAscendancySelect(build.ascendancy ?? '', ascendancyNames)}
      </label>
      <label class="edit-field edit-field-full">
        <span class="edit-label">Description</span>
        <textarea rows="3" onchange="updateBuildRootField('description', this.value)">${esc(build.description ?? '')}</textarea>
      </label>
    </div>
    <div class="preview-edit-section">
      <h3>Skills</h3>
      <div id="preview-skills-edit"></div>
    </div>
    <div class="preview-edit-section">
      <h3>Passives</h3>
      <div id="preview-passives-edit"></div>
    </div>
    <div class="preview-edit-section">
      <h3>Ascendancy</h3>
      <div id="preview-ascendancy-edit"></div>
    </div>
    <div class="preview-edit-section">
      <h3>Items</h3>
      <div id="preview-items-edit"></div>
    </div>
  `;

  renderEditableSkills(build.skills ?? [], 'preview-skills-edit');
  renderEditablePassives(splitPassives.regular, report, passiveNames, 'preview-passives-edit');
  renderEditablePassives(splitPassives.ascendancy, report, passiveNames, 'preview-ascendancy-edit', { title: 'Ascendancy Points', hideBuildOptions: true });
  renderEditableItems(build.items ?? [], 'preview-items-edit');
}

function renderAscendancySelect(current, ascendancyNames = {}) {
  const selected = String(current ?? '');
  const entries = Object.entries(ascendancyNames);
  if (!entries.length) {
    return `<input type="text" value="${escAttr(selected)}" onchange="updateBuildRootField('ascendancy', this.value)" />`;
  }

  const hasSelected = !selected || entries.some(([id]) => id === selected);
  const customOption = hasSelected ? '' : `<option value="${escAttr(selected)}" selected>${esc(selected)}</option>`;
  const options = entries
    .map(([id, name]) => `<option value="${escAttr(id)}"${id === selected ? ' selected' : ''}>${esc(name)}</option>`)
    .join('');

  return `<select onchange="updateBuildRootField('ascendancy', this.value)">
    <option value="">None</option>
    ${customOption}
    ${options}
  </select>`;
}

function ascendancyDisplayName(value, ascendancyNames = {}) {
  return ascendancyNames[value] || value;
}

function splitAscendancyPassives(passives, passiveAscendancies = {}) {
  const regular = [];
  const ascendancy = [];

  passives.forEach((passive, index) => {
    const id = typeof passive === 'string' ? passive : passive?.id;
    const entry = { passive, index };
    if (isAscendancyPassiveId(id, passiveAscendancies)) ascendancy.push(entry);
    else regular.push(entry);
  });

  return { regular, ascendancy };
}

function isAscendancyPassiveId(id, passiveAscendancies = {}) {
  if (!id) return false;
  const normalized = String(id).trim();
  return Boolean(passiveAscendancies[normalized] || /^Ascendancy[A-Za-z]+\d/.test(normalized));
}

function renderSkillsTab(skills) {
  const copyBtn = `<button class="section-copy-btn ghost sm" onclick="copySection('skills')">Copy JSON</button>`;
  if (!skills.length) {
    $('tab-skills').innerHTML = `<div class="tab-section-header">${copyBtn}</div><p class="empty-msg">No skills found in this build.</p>`;
    return;
  }

  const html = skills.map((skill) => {
    const normalized = normalizeBuildSkill(skill);
    const supports = normalized.support_skills.map((support) => {
      const level = normalizeLevelIntervalValue(support.level_interval)[0];
      const label = support.additional_text ? `${gemName(support.id)} - ${support.additional_text}` : gemName(support.id);
      return `<li><span>${esc(label)}</span><span class="tag">Lvl ${level}</span></li>`;
    }).join('');
    const level = normalizeLevelIntervalValue(normalized.level_interval)[0];

    return `<li class="gem-group">
      <div class="gem-head"><strong>${esc(gemName(normalized.id))}</strong><span class="tag">Lvl ${level}</span></div>
      ${normalized.additional_text ? `<div class="muted small">${esc(normalized.additional_text)}</div>` : ''}
      ${supports ? `<ul class="gem-supports">${supports}</ul>` : ''}
    </li>`;
  }).join('');

  $('tab-skills').innerHTML = `<div class="tab-section-header">${copyBtn}</div><ul class="gem-list">${html}</ul>`;
}

function renderPassivesTab(passives, report, passiveNames = {}) {
  const total = passives.length;
  const weaponSet1 = passives.filter((p) => getWeaponSet(p) === 1);
  const weaponSet2 = passives.filter((p) => getWeaponSet(p) === 2);
  const copyBtn = `<button class="section-copy-btn ghost sm" onclick="copySection('passives')">Copy JSON</button>`;

  $('tab-passives').innerHTML = `
    <div class="tab-section-header">${copyBtn}</div>
    <div class="passives-summary">
      <div class="pass-block"><span class="pass-num green">${total}</span><span class="pass-label">Resolved Nodes</span></div>
      ${(weaponSet1.length || weaponSet2.length) ? `<div class="pass-block"><span class="pass-num">${weaponSet1.length + weaponSet2.length}</span><span class="pass-label">Weapon Set Nodes</span></div>` : ''}
    </div>
    ${passives.length ? `<div class="passives-sections">
      ${passives.map((passive) => {
        const normalized = normalizePassive(passive);
        const name = passiveNames[normalized.id] || formatPassiveId(normalized.id);
        const tags = [
          normalized.weaponSet ? `<span class="tag">Weapon ${normalized.weaponSet}</span>` : '',
          normalized.levelInterval ? renderIntervalTag(normalized.levelInterval) : '',
        ].filter(Boolean).join('');
        return `<div class="passive-section"><div><strong>${esc(name)}</strong><div class="muted small">${esc(normalized.id)}</div></div><div>${tags}</div></div>`;
      }).join('')}
    </div>` : ''}
  `;
}

function renderItemsTab(items) {
  const copyBtn = `<button class="section-copy-btn ghost sm" onclick="copySection('items')">Copy JSON</button>`;
  if (!items.length) {
    $('tab-items').innerHTML = `<div class="tab-section-header">${copyBtn}</div><p class="empty-msg">No items found in this build.</p>`;
    return;
  }

  const rows = items.map((item) => `
    <div class="item-row">
      <div class="item-slot">${esc(prettySlot(item.inventory_id))}</div>
      <div>
        <strong>${esc(item.unique_name || item.inventory_id || 'Item')}</strong>
        ${item.additional_text ? `<div class="item-lines">${esc(item.additional_text).replace(/\n/g, '<br>')}</div>` : ''}
      </div>
    </div>
  `).join('');

  $('tab-items').innerHTML = `<div class="tab-section-header">${copyBtn}</div><div class="items-table">${rows}</div>`;
}

function renderProblemsTab(r) {
  const notes = uniqueValues([...(r.warnings ?? []), ...(craftingState ? getCraftingWarnings() : [])]);
  const section = (cls, icon, title, items) => `
    <div class="problems-section ${cls}">
      <h3>${icon} ${title} (${items.length})</h3>
      <ul>${items.length
        ? items.map((i) => `<li>${esc(i)}</li>`).join('')
        : '<li class="empty">none</li>'
      }</ul>
    </div>`;

  $('tab-problems').innerHTML =
    section('ph-guessed',     '⚠️', 'Guessed',     r.guessed) +
    section('ph-unsupported', '❌', 'Unsupported', r.unsupported) +
    section('ph-warnings',    '📝', 'Notes',       notes);
}

// ── Set selectors ──────────────────────────────────────────────────────────
function renderSetSelectors({ skillSets, itemSets, treeSpecs }) {
  const hasSets = skillSets.length > 1 || itemSets.length > 1 || treeSpecs.length > 1;
  if (!hasSets) { $('set-selector').classList.add('hidden'); return; }

  populateSelect('sel-gems', skillSets, 'id');
  populateSelect('sel-gear', itemSets,  'id');
  populateSelect('sel-tree', treeSpecs, 'index');

  $('gems-field').classList.toggle('hidden', skillSets.length <= 1);
  $('gear-field').classList.toggle('hidden', itemSets.length  <= 1);
  $('tree-field').classList.toggle('hidden', treeSpecs.length <= 1);

  $('set-selector').classList.remove('hidden');
}

function populateSelect(id, items, valueKey) {
  const sel = $(id);
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value       = item[valueKey];
    opt.textContent = item.title;
    sel.appendChild(opt);
  }
  if (prev !== '' && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

// Crafting Simulator
async function openCraftingSimulator() {
  $('results')?.classList.remove('hidden');
  if (!craftingDataLoaded) {
    const tabEl = $('tab-crafting');
    if (tabEl) tabEl.innerHTML = '<div style="padding:40px 24px;color:var(--muted-2)">Loading crafting data…</div>';
    switchTab('crafting');
    const ok = await loadCraftingData();
    if (!ok) {
      if (tabEl) tabEl.innerHTML = `<div style="padding:40px 24px;color:var(--red)">Failed to load crafting data: ${craftingDataError}</div>`;
      return;
    }
  }
  ensureCraftingState();
  renderCraftingSimulator();
  switchTab('crafting');
}

function ensureCraftingState() {
  if (craftingState) return craftingState;
  const base = CRAFTING_ITEM_BASES[0] ?? {
    id: 'fallback', name: 'Unknown Item', category: 'Weapon', type: 'weapon',
    itemLevel: 1, implicits: [], tags: [],
  };
  // Default to item level 83 — base.itemLevel is the equip requirement, not the crafting level
  const defaultItemLevel = 83;
  craftingState = {
    item: createCraftedItem(base, defaultItemLevel),
    history: [],
    log: [{ action: 'select-base', result: `Selected ${base.name}, item level ${defaultItemLevel}` }],
    warnings: [],
    target: { modId: '', minTier: 3, strategy: 'alchemy' },
    simulation: null,
    method: 'currency',
    selectedEssence: '',
    selectedRune: '',
    selectedSoulCore: '',
    selectedAbyss: '',
    selectedDesecration: '',
    selectedQuality: '',
    selectedCorruption: '',
    selectedSocketCraft: '',
  };
  return craftingState;
}

function createCraftedItem(base, itemLevel = base.itemLevel) {
  return {
    base: cloneCraftingValue(base),
    rarity: 'normal',
    quality: 0,
    itemLevel: clampCraftingNumber(itemLevel, 1, 100),
    implicits: (base.implicits ?? []).map(randomizeModifierValues),
    prefixes: [],
    suffixes: [],
    runes: [],
    corrupted: false,
    mirrored: false,
    properties: { Sockets: "" },
    craftingLog: [],
  };
}

function renderCraftingSimulator() {
  // If data isn't loaded yet and we're not on the standalone crafting page, show a placeholder
  if (!craftingDataLoaded && !craftingState) {
    const tabEl = $('tab-crafting');
    if (tabEl) tabEl.innerHTML = '<div style="padding:40px 24px;color:var(--muted-2)">Crafting data will load when you open the Crafting Simulator tab.</div>';
    return;
  }
  ensureCraftingState();
  const item = craftingState.item;
  const categories = uniqueValues(CRAFTING_ITEM_BASES.map((b) => b.category));
  const selectedCategory = item.base.category;
  const search = $('craft-base-search')?.value ?? '';
  const types = uniqueValues(CRAFTING_ITEM_BASES.filter((b) => b.category === selectedCategory).map((b) => b.type));
  const filteredBases = filterCraftingBases(selectedCategory, $('craft-base-type')?.value || item.base.type, search);
  
  const targetOptions = CRAFTING_MODIFIERS
    .filter((m) => validModifierForBase(m, item.base, item.itemLevel))
    .concat([
      { id: "corruption-implicit-1", name: "Corrupted Implicit", text: "+1 to Level of socketed Skill Gems", tier: 1 },
      { id: "corruption-implicit-2", name: "Corrupted Implicit", text: "+5% to maximum Fire Resistance", tier: 1 },
      { id: "corruption-implicit-3", name: "Corrupted Implicit", text: "4% increased maximum Life", tier: 1 }
    ])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => `<option value="${escAttr(m.id)}"${craftingState.target.modId === m.id ? ' selected' : ''}>${esc(m.name)} ${m.tier ? 'T' + m.tier : ''} - ${esc(m.text)}</option>`)
    .join('');

  const essenceOptions = CRAFTING_ESSENCES
    .map((e) => `<option value="${escAttr(e.id)}"${craftingState.selectedEssence === e.id ? ' selected' : ''}>${esc(e.name)}</option>`)
    .join('');
  const omenOptions = CRAFTING_OMENS
    .map((o) => `<option value="${escAttr(o.id)}"${craftingState.activeOmen === o.id ? ' selected' : ''}>${esc(o.name)}</option>`)
    .join('');
  const runeOptions = CRAFTING_RUNES
    .map((r) => `<option value="${escAttr(r.id)}"${craftingState.selectedRune === r.id ? ' selected' : ''}>${esc(r.name)}</option>`)
    .join('');
  const soulCoreOptions = CRAFTING_SOUL_CORES
    .map((c) => `<option value="${escAttr(c.id)}"${craftingState.selectedSoulCore === c.id ? ' selected' : ''}>${esc(c.name)}</option>`)
    .join('');
  const abyssOptions = CRAFTING_ABYSS_DATA
    .map((a) => `<option value="${escAttr(a.id)}"${craftingState.selectedAbyss === a.id ? ' selected' : ''}>${esc(a.name)}</option>`)
    .join('');
  const desecrationOptions = CRAFTING_DESECRATION_DATA
    .map((d) => {
      const valResult = validateCraftingAction(item, { type: 'desecration', desecrationId: d.id });
      const disabledAttr = !valResult.ok ? ' disabled' : '';
      const tooltipReason = !valResult.ok ? ` title="${escAttr(valResult.reason)}"` : '';
      return `<option value="${escAttr(d.id)}"${craftingState.selectedDesecration === d.id ? ' selected' : ''}${disabledAttr}${tooltipReason}>${esc(d.name)}${!valResult.ok ? ' (Invalid)' : ''}</option>`;
    })
    .join('');
  const qualityOptions = CRAFTING_QUALITY_DATA
    .map((q) => `<option value="${escAttr(q.id)}"${craftingState.selectedQuality === q.id ? ' selected' : ''}>${esc(q.name)}</option>`)
    .join('');
  const corruptionOptions = CRAFTING_CORRUPTION_DATA
    .map((c) => `<option value="${escAttr(c.id)}"${craftingState.selectedCorruption === c.id ? ' selected' : ''}>${esc(c.name)}</option>`)
    .join('');
  const socketOptions = CRAFTING_SOCKET_CRAFTING_DATA
    .map((s) => `<option value="${escAttr(s.id)}"${craftingState.selectedSocketCraft === s.id ? ' selected' : ''}>${esc(s.name)} - ${esc(s.description)}</option>`)
    .join('');

  const activeOmen = craftingState.activeOmen
    ? CRAFTING_OMENS.find((o) => o.id === craftingState.activeOmen)
    : null;

  $('tab-crafting').innerHTML = `
    <div class="craft-shell">
      <div class="craft-topbar">
        <div>
          <h3>Crafting Simulator</h3>
          <p>PoE2-style item crafting with real modifier pools. <span class="data-source">Data: <a href="https://poe2db.tw" target="_blank">poe2db.tw</a> &mdash; ${CRAFTING_ITEM_BASES.length} bases, ${CRAFTING_MODIFIERS.length} modifiers</span></p>
        </div>
        <div class="craft-top-actions">
          <button class="ghost sm" type="button" onclick="copyCraftedItemJson()">Copy JSON</button>
          <button class="ghost sm" type="button" onclick="exportCraftedItemToBuild()">Send to Items</button>
        </div>
      </div>
      <div class="craft-grid">
        <section class="craft-panel">
          <h4>Item Base Selection</h4>
          <label class="edit-field"><span class="edit-label">Category</span><select id="craft-base-category" onchange="updateCraftingBaseFilters()">${categories.map((category) => `<option value="${escAttr(category)}"${category === selectedCategory ? ' selected' : ''}>${esc(category)}</option>`).join('')}</select></label>
          <label class="edit-field"><span class="edit-label">Item Type</span><select id="craft-base-type" onchange="updateCraftingBaseFilters()">${types.map((type) => `<option value="${escAttr(type)}"${type === item.base.type ? ' selected' : ''}>${esc(titleCase(type))}</option>`).join('')}</select></label>
          <label class="edit-field"><span class="edit-label">Search Base</span><input id="craft-base-search" value="${escAttr(search)}" oninput="updateCraftingBaseFilters()" placeholder="Longbow, ring, robe..." /></label>
          <label class="edit-field"><span class="edit-label">Base</span><select id="craft-base-id" onchange="selectCraftingBase(this.value)">${filteredBases.map((base) => `<option value="${escAttr(base.id)}"${base.id === item.base.id ? ' selected' : ''}>${esc(base.name)}</option>`).join('')}</select></label>
          <label class="edit-field"><span class="edit-label">Item Level</span><input type="number" min="1" max="100" value="${item.itemLevel}" onchange="updateCraftingItemLevel(this.value)" /></label>
          <div class="craft-base-info">
            <div><strong>Requirements</strong><span>${esc(item.base.requirements || 'Unknown')}</span></div>
            <div><strong>Tags</strong><span>${esc(item.base.tags.join(', '))}</span></div>
            <div><strong>Implicit</strong><span>${item.implicits.length ? item.implicits.map(formatModifierLine).map(esc).join('<br>') : 'None'}</span></div>
          </div>
        </section>
        <section class="craft-panel craft-preview-panel"><h4>Current Item Preview</h4>${renderCraftedItemCard(item)}</section>
        <section class="craft-panel">
          <h4>Crafting Method</h4>
          <label class="edit-field">
            <span class="edit-label">Method</span>
            <select id="craft-method" onchange="updateCraftingMethod(this.value)">
              <option value="currency"${(craftingState.method ?? 'currency') === 'currency' ? ' selected' : ''}>Currency Orbs</option>
              <option value="essence"${craftingState.method === 'essence' ? ' selected' : ''}>Essence</option>
              <option value="omen"${craftingState.method === 'omen' ? ' selected' : ''}>Omen</option>
              <option value="rune"${craftingState.method === 'rune' ? ' selected' : ''}>Rune</option>
              <option value="soul_core"${craftingState.method === 'soul_core' ? ' selected' : ''}>Soul Core</option>
              <option value="abyss"${craftingState.method === 'abyss' ? ' selected' : ''}>Abyss</option>
              <option value="desecration"${craftingState.method === 'desecration' ? ' selected' : ''}>Desecration</option>
              <option value="quality"${craftingState.method === 'quality' ? ' selected' : ''}>Quality</option>
              <option value="corruption"${craftingState.method === 'corruption' ? ' selected' : ''}>Corruption</option>
              <option value="socket"${craftingState.method === 'socket' ? ' selected' : ''}>Socket Crafting</option>
            </select>
          </label>
          ${craftingState.method === 'essence' ? `
          <div class="craft-essence-section">
            <h4>Essence Crafting</h4>
            <label class="edit-field">
              <span class="edit-label">Essence</span>
              <select id="craft-essence-id" onchange="updateCraftingEssenceSelection(this.value)">
                <option value="">Choose essence</option>${essenceOptions}
              </select>
            </label>
            <button class="ghost sm" type="button" onclick="applyCraftingEssence()">Apply Essence</button>
            ${craftingState.selectedEssence ? `<p class="craft-info">${esc(CRAFTING_ESSENCES.find((e) => e.id === craftingState.selectedEssence)?.description ?? '')} <br><strong>Status:</strong> Implemented</p>` : ''}
          </div>` : ''}
          ${craftingState.method === 'omen' ? `
          <div class="craft-omen-section">
            <h4>Omen</h4>
            <label class="edit-field">
              <span class="edit-label">Active Omen</span>
              <select id="craft-omen-id" onchange="updateCraftingOmenSelection(this.value)">
                <option value="">None</option>${omenOptions}
              </select>
            </label>
            ${activeOmen ? `<p class="craft-info"><strong>${esc(activeOmen.name)}:</strong> ${esc(activeOmen.effect)}<br><em style="opacity:.7">Use a currency orb to apply &amp; consume the omen.</em></p>` : '<p class="craft-info" style="opacity:.6">Select an omen, then use a currency orb to trigger its effect.</p>'}
          </div>` : ''}
          ${craftingState.method === 'rune' ? `
          <div class="craft-rune-section">
            <h4>Rune Socketing</h4>
            <label class="edit-field">
              <span class="edit-label">Rune</span>
              <select id="craft-rune-id" onchange="updateCraftingRuneSelection(this.value)">
                <option value="">Choose rune</option>${runeOptions}
              </select>
            </label>
            <button class="ghost sm" type="button" onclick="applyCraftingRune()">Socket Rune</button>
            ${craftingState.selectedRune ? `<p class="craft-info">${esc(CRAFTING_RUNES.find((r) => r.id === craftingState.selectedRune)?.description ?? '')}</p>` : ''}
            ${(item.runes ?? []).length ? `<p class="craft-info"><strong>Socketed (${item.runes.length}/4):</strong> ${item.runes.map((r) => esc(r.name)).join(', ')}</p>` : ''}
          </div>` : ''}
          ${craftingState.method === 'soul_core' ? `
          <div class="craft-soul-core-section">
            <h4>Soul Core Socketing</h4>
            <label class="edit-field">
              <span class="edit-label">Soul Core</span>
              <select id="craft-soul-core-id" onchange="updateCraftingSoulCoreSelection(this.value)">
                <option value="">Choose soul core</option>${soulCoreOptions}
              </select>
            </label>
            <button class="ghost sm" type="button" onclick="applyCraftingSoulCore()">Apply Soul Core</button>
            ${craftingState.selectedSoulCore ? `<p class="craft-info">${esc(CRAFTING_SOUL_CORES.find((c) => c.id === craftingState.selectedSoulCore)?.description ?? '')} <br><strong>Status:</strong> ${CRAFTING_SOUL_CORES.find((c) => c.id === craftingState.selectedSoulCore)?.dataComplete ? 'Implemented (Complete data)' : 'Implemented (Partial data)'}</p>` : ''}
          </div>` : ''}
          ${craftingState.method === 'abyss' ? `
          <div class="craft-abyss-section">
            <h4>Abyss Mechanic</h4>
            <label class="edit-field">
              <span class="edit-label">Mechanic</span>
              <select id="craft-abyss-id" onchange="updateCraftingAbyssSelection(this.value)">
                <option value="">Choose Abyss craft</option>${abyssOptions}
              </select>
            </label>
            <button class="ghost sm" type="button" onclick="applyAbyssMechanic()">Apply Abyss Mechanic</button>
            ${craftingState.selectedAbyss ? `<p class="craft-info">${esc(CRAFTING_ABYSS_DATA.find((a) => a.id === craftingState.selectedAbyss)?.description ?? '')} <br><strong>Status:</strong> ${CRAFTING_ABYSS_DATA.find((a) => a.id === craftingState.selectedAbyss)?.dataComplete ? 'Implemented' : 'Partial data'}</p>` : ''}
          </div>` : ''}
          ${craftingState.method === 'desecration' ? `
          <div class="craft-desecration-section">
            <h4>Desecration Crafting</h4>
            <label class="edit-field">
              <span class="edit-label">Mechanic</span>
              <select id="craft-desecration-id" onchange="updateCraftingDesecrationSelection(this.value)">
                <option value="">Choose Desecration craft</option>${desecrationOptions}
              </select>
            </label>
            <button class="ghost sm" type="button" onclick="applyDesecrationMechanic()">Apply Desecration</button>
            ${(() => {
              if (!craftingState.selectedDesecration) return '';
              const d = CRAFTING_DESECRATION_DATA.find((x) => x.id === craftingState.selectedDesecration);
              if (!d) return '';
              
              const validation = validateCraftingAction(item, { type: 'desecration', desecrationId: d.id });
              const compatibilityLabel = validation.ok
                ? `<span style="display:inline-block;background:#065f46;color:#34d399;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;">Valid for this item</span>`
                : `<span style="display:inline-block;background:#991b1b;color:#fca5a5;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;">Invalid for this item: ${esc(validation.reason)}</span>`;

              const incompleteBadge = !d.dataComplete
                ? `<div style="background:rgba(245,158,11,0.1);border:1px solid #f59e0b;color:#f59e0b;padding:8px 12px;border-radius:4px;font-size:12px;margin:8px 0;line-height:1.4;">
                     ⚠️ Desecration data incomplete — behavior may not match the game.
                   </div>`
                : '';

              const affects = [
                d.addsModifiers && 'explicit modifiers',
                d.removesModifiers && 'removes modifiers',
                d.rerollsModifiers && 'rerolls modifiers',
                d.corruptsItem && 'corruption',
                d.modifiesImplicit && 'implicit modifiers',
                d.modifiesExplicit && 'explicit modifiers',
                d.consumesItem && 'consumes item',
                d.oneTimeUse && 'one time use'
              ].filter(Boolean);
              
              if (d.requiredRarity) affects.push('rarity');
              if (d.allowedItemTags.length || d.forbiddenItemTags?.length) affects.push('item tags');

              const pool = getDesecrationModifierPool(item, d);
              const poolWarning = (d.addsModifiers && pool.length === 0)
                ? `<div style="color:#ef4444;font-size:11px;margin-top:4px;">⚠️ No valid Desecration modifier pool</div>`
                : '';

              return `
                <p class="craft-info" style="margin-top:12px;">
                  ${esc(d.description)}
                  <br><br>
                  ${compatibilityLabel}
                  ${incompleteBadge}
                  ${poolWarning}
                  <br>
                  <strong>Source:</strong> <span style="text-transform: capitalize;">${esc(d.source)}</span>
                  <br>
                  <strong>Affects:</strong> ${esc(affects.join(', ') || 'None')}
                </p>
              `;
            })()}
          </div>` : ''}
          ${craftingState.method === 'quality' ? `
          <div class="craft-quality-section">
            <h4>Quality Crafting</h4>
            <label class="edit-field">
              <span class="edit-label">Currency</span>
              <select id="craft-quality-id" onchange="updateCraftingQualitySelection(this.value)">
                <option value="">Choose quality currency</option>${qualityOptions}
              </select>
            </label>
            <button class="ghost sm" type="button" onclick="applyQualityMechanic()">Apply Quality</button>
            ${craftingState.selectedQuality ? `<p class="craft-info">${esc(CRAFTING_QUALITY_DATA.find((q) => q.id === craftingState.selectedQuality)?.description ?? '')} <br><strong>Status:</strong> Implemented</p>` : ''}
          </div>` : ''}
          ${craftingState.method === 'corruption' ? `
          <div class="craft-corruption-section">
            <h4>Vaal Orb Corruption</h4>
            <label class="edit-field">
              <span class="edit-label">Outcome</span>
              <select id="craft-corruption-id" onchange="updateCraftingCorruptionSelection(this.value)">
                <option value="">Choose corruption type</option>${corruptionOptions}
              </select>
            </label>
            <button class="ghost sm" type="button" onclick="applyCorruptionMechanic()">Corrupt Item</button>
            ${craftingState.selectedCorruption ? `<p class="craft-info">${esc(CRAFTING_CORRUPTION_DATA.find((c) => c.id === craftingState.selectedCorruption)?.name ?? '')} <br><strong>Status:</strong> Implemented</p>` : ''}
          </div>` : ''}
          ${craftingState.method === 'socket' ? `
          <div class="craft-socket-section">
            <h4>Socket Crafting</h4>
            <label class="edit-field">
              <span class="edit-label">Operation</span>
              <select id="craft-socket-id" onchange="updateCraftingSocketSelection(this.value)">
                <option value="">Choose socket craft</option>${socketOptions}
              </select>
            </label>
            <button class="ghost sm" type="button" onclick="applySocketCraftingMechanic()">Modify Sockets</button>
            ${craftingState.selectedSocketCraft ? `<p class="craft-info">${esc(CRAFTING_SOCKET_CRAFTING_DATA.find((s) => s.id === craftingState.selectedSocketCraft)?.description ?? '')} <br><strong>Status:</strong> Implemented</p>` : ''}
          </div>` : ''}
          <h4>Crafting Actions</h4>
          <div class="craft-actions">
            ${renderCraftActionButton('transmute', 'Orb of Transmutation')}
            ${renderCraftActionButton('augment', 'Orb of Augmentation')}
            ${renderCraftActionButton('regal', 'Regal Orb')}
            ${renderCraftActionButton('exalt', 'Exalted Orb')}
            ${renderCraftActionButton('chaos', 'Chaos Orb')}
            ${renderCraftActionButton('alchemy', 'Orb of Alchemy')}
            ${renderCraftActionButton('annul', 'Orb of Annulment')}
            ${renderCraftActionButton('chance', 'Orb of Chance')}
            ${renderCraftActionButton('undo', 'Undo Last Step')}
            ${renderCraftActionButton('reset', 'Reset Item')}
          </div>
          <div class="craft-target">
            <h4>Target Craft</h4>
            <label class="edit-field"><span class="edit-label">Desired Modifier</span><select id="craft-target-mod" onchange="updateCraftingTarget('modId', this.value)"><option value="">Choose target</option>${targetOptions}</select></label>
            <label class="edit-field"><span class="edit-label">Strategy</span><select id="craft-target-strategy" onchange="updateCraftingTarget('strategy', this.value)"><option value="alchemy"${(craftingState.target.strategy ?? 'alchemy') === 'alchemy' ? ' selected' : ''}>Alchemy Orb Spam</option><option value="chaos"${craftingState.target.strategy === 'chaos' ? ' selected' : ''}>Chaos Orb Spam</option><option value="transmute"${craftingState.target.strategy === 'transmute' ? ' selected' : ''}>Transmute + Augment + Regal</option><option value="essence"${craftingState.target.strategy === 'essence' ? ' selected' : ''}>Essence Spam</option><option value="exalt"${craftingState.target.strategy === 'exalt' ? ' selected' : ''}>Exalt Slam</option><option value="abyss"${craftingState.target.strategy === 'abyss' ? ' selected' : ''}>Abyss-assisted craft</option><option value="desecration"${craftingState.target.strategy === 'desecration' ? ' selected' : ''}>Desecration Spam</option><option value="desecration_exalt"${craftingState.target.strategy === 'desecration_exalt' ? ' selected' : ''}>Desecration + Exalt Slam</option><option value="desecration_chaos"${craftingState.target.strategy === 'desecration_chaos' ? ' selected' : ''}>Desecration + Chaos</option><option value="desecration_assisted"${craftingState.target.strategy === 'desecration_assisted' ? ' selected' : ''}>Desecration-assisted craft</option><option value="rune_soul"${craftingState.target.strategy === 'rune_soul' ? ' selected' : ''}>Rune/Soul Core setup</option><option value="corruption"${craftingState.target.strategy === 'corruption' ? ' selected' : ''}>Corruption Attempt</option></select></label>
            <label class="edit-field"><span class="edit-label">Minimum Tier</span><select id="craft-target-tier" onchange="updateCraftingTarget('minTier', this.value)">${[1, 2, 3, 4, 5].map((tier) => `<option value="${tier}"${Number(craftingState.target.minTier) === tier ? ' selected' : ''}>Tier ${tier} or better</option>`).join('')}</select></label>
            <div class="craft-actions two"><button class="ghost sm" type="button" onclick="simulateTargetCrafts(100)">Simulate 100 crafts</button><button class="ghost sm" type="button" onclick="simulateTargetCrafts(1000)">Simulate 1000 crafts</button></div>
            ${renderCraftingSimulation()}
          </div>
        </section>
      </div>
      <section class="craft-panel craft-bottom">
        <div><h4>Crafting Log</h4><ol class="craft-log">${craftingState.log.map((entry, index) => `<li><span>${index + 1}.</span>${esc(entry.result)}</li>`).join('')}</ol></div>
        <div><h4>Warnings</h4><ul class="craft-warnings">${getCraftingWarnings().map((warning) => `<li>${esc(warning)}</li>`).join('')}</ul></div>
      </section>
    </div>`;
  refreshProblemsAfterCraftingChange();
}

function renderCraftActionButton(action, label) {
  const validation = validateCraftingAction(craftingState.item, action);
  return `<button class="ghost sm${validation.ok ? '' : ' disabled'}" type="button" onclick="applyCraftingAction('${action}')" title="${escAttr(validation.ok ? label : validation.reason)}">${esc(label)}</button>`;
}

function renderBaseStats(item) {
  const s = item.base.stats;
  if (!s) return '';
  const q = item.quality ?? 0;
  const qMult = 1 + q / 100;
  const lines = [];
  // Armour-type defences (scale with quality)
  if (s.armour)       lines.push(`<div class="poe-item-stat">Armour: <span class="poe-stat-val">${Math.round(s.armour * qMult)}</span></div>`);
  if (s.evasion)      lines.push(`<div class="poe-item-stat">Evasion Rating: <span class="poe-stat-val">${Math.round(s.evasion * qMult)}</span></div>`);
  if (s.energyShield) lines.push(`<div class="poe-item-stat">Energy Shield: <span class="poe-stat-val">${Math.round(s.energyShield * qMult)}</span></div>`);
  if (s.block)        lines.push(`<div class="poe-item-stat">Chance to Block: <span class="poe-stat-val">${s.block}%</span></div>`);
  // Weapon stats (physical damage scales with quality)
  if (s.damageMin != null && s.damageMax != null) {
    const scaledMin = Math.round(s.damageMin * qMult);
    const scaledMax = Math.round(s.damageMax * qMult);
    lines.push(`<div class="poe-item-stat">Physical Damage: <span class="poe-stat-val">${scaledMin}–${scaledMax}</span></div>`);
    if (s.aps) {
      const dps = ((scaledMin + scaledMax) / 2 * s.aps).toFixed(1);
      lines.push(`<div class="poe-item-stat">Attacks per Second: <span class="poe-stat-val">${s.aps.toFixed(2)}</span></div>`);
      lines.push(`<div class="poe-item-stat">DPS: <span class="poe-stat-val">${dps}</span></div>`);
    }
  }
  if (!lines.length) return '';
  return `<div class="poe-item-sep"></div>${lines.join('')}`;
}

function renderCraftedItemCard(item) {
  const rarityClass = `rarity-${item.rarity}`;
  const prefixLimit = craftingPrefixLimit(item.rarity);
  const suffixLimit = craftingSuffixLimit(item.rarity);
  const corruptedTag = item.corrupted ? `<div class="poe-item-meta" style="color:var(--red,#ef4444);font-weight:bold;">Corrupted</div>` : '';
  const mirroredTag = item.mirrored ? `<div class="poe-item-meta" style="color:var(--blue,#3b82f6);font-weight:bold;">Mirrored</div>` : '';
  
  return `
    <div class="poe-item-card ${rarityClass}">
      <div class="poe-item-name">${esc(craftedItemName(item))}</div>
      <div class="poe-item-base">${esc(item.base.name)}</div>
      <div class="poe-item-sep"></div>
      <div class="poe-item-meta">Rarity: ${esc(titleCase(item.rarity))}</div>
      <div class="poe-item-meta">Quality: +${item.quality}%</div>
      <div class="poe-item-meta">Item Level: ${item.itemLevel}</div>
      ${corruptedTag}
      ${mirroredTag}
      ${renderBaseStats(item)}
      ${item.implicits.length ? `<div class="poe-item-sep"></div>${item.implicits.map((m) => `<div class="poe-item-implicit">${esc(formatModifierLine(m))}</div>`).join('')}` : ''}
      ${(item.runes ?? []).length ? `<div class="poe-item-sep"></div>${item.runes.map((r) => `<div class="poe-item-implicit" style="color:var(--amber,#f59e0b)">${esc(r.text)} <em style="opacity:.6">(${esc(r.name)})</em></div>`).join('')}` : ''}
      <div class="poe-item-sep"></div>
      ${item.prefixes.length ? item.prefixes.map((m) => `<div class="poe-item-mod prefix">${esc(formatModifierLine(m))}</div>`).join('') : '<div class="poe-item-empty">No prefixes</div>'}
      ${item.suffixes.length ? item.suffixes.map((m) => `<div class="poe-item-mod suffix">${esc(formatModifierLine(m))}</div>`).join('') : '<div class="poe-item-empty">No suffixes</div>'}
      <div class="poe-item-sep"></div>
      <div class="poe-item-meta">Open Prefixes: ${prefixLimit - item.prefixes.length} (${item.prefixes.length}/${prefixLimit})</div>
      <div class="poe-item-meta">Open Suffixes: ${suffixLimit - item.suffixes.length} (${item.suffixes.length}/${suffixLimit})</div>
    </div>`;
}

function renderCraftingSimulation() {
  const sim = craftingState.simulation;
  if (!sim) return '<p class="craft-sim-empty">Choose a target and run a simulation.</p>';
  
  const strategy = craftingState.target.strategy ?? 'alchemy';
  const isDesecrationStrat = ['desecration', 'desecration_exalt', 'desecration_chaos', 'desecration_assisted'].includes(strategy);
  const desecration = CRAFTING_DESECRATION_DATA.find(d => d.id === craftingState.selectedDesecration);
  const isIncomplete = isDesecrationStrat && desecration && !desecration.dataComplete;
  
  const incompleteWarning = isIncomplete ? `
    <div class="craft-sim-warning" style="color: #f59e0b; font-size: 11px; margin-top: 8px; border: 1px solid #f59e0b; padding: 4px 8px; border-radius: 4px; background: rgba(245, 158, 11, 0.1);">
      ⚠️ Desecration simulation uses incomplete data.
    </div>
  ` : '';

  return `
    <div class="craft-sim-result">
      <div><strong>${sim.successes}</strong><span>successes</span></div>
      <div><strong>${sim.chance.toFixed(2)}%</strong><span>estimated chance</span></div>
      <div><strong>${sim.averageCurrency.toFixed(1)}</strong><span>avg tries / success</span></div>
    </div>
    <div class="craft-sim-cost" style="font-size:12px;opacity:0.8;margin:8px 0;padding:6px;background:rgba(255,255,255,0.05);border-radius:4px;">
      <strong>Spent:</strong> ${esc(sim.spentString || 'N/A')}
    </div>
    ${sim.bestItem ? `<div class="craft-best"><strong>Best hit:</strong> ${esc(craftedItemName(sim.bestItem))}</div>` : ''}
    ${incompleteWarning}
  `;
}

function filterCraftingBases(category, type, search) {
  const needle = String(search ?? '').trim().toLowerCase();
  let bases = CRAFTING_ITEM_BASES.filter((base) => base.category === category);
  if (type) bases = bases.filter((base) => base.type === type);
  if (needle) bases = bases.filter((base) => base.name.toLowerCase().includes(needle));
  return bases.length ? bases : CRAFTING_ITEM_BASES.filter((base) => base.category === category);
}

function updateCraftingBaseFilters() {
  const category = $('craft-base-category')?.value || craftingState.item.base.category;
  const currentType = $('craft-base-type')?.value || '';
  const search = $('craft-base-search')?.value ?? '';
  const types = uniqueValues(CRAFTING_ITEM_BASES.filter((b) => b.category === category).map((b) => b.type));
  const nextType = types.includes(currentType) ? currentType : types[0];
  const filteredBases = filterCraftingBases(category, nextType, search);

  // If the search field is focused, update only the base <select> in-place
  // to avoid a full re-render that would destroy the input and kill focus.
  const searchEl = $('craft-base-search');
  const baseEl = $('craft-base-id');
  if (searchEl && document.activeElement === searchEl && baseEl) {
    baseEl.innerHTML = filteredBases
      .map((b) => `<option value="${escAttr(b.id)}"${b.id === craftingState.item.base.id ? ' selected' : ''}>${esc(b.name)}</option>`)
      .join('');
    return;
  }

  const base = filteredBases[0];
  if (base) selectCraftingBase(base.id);
}

function selectCraftingBase(baseId) {
  const base = CRAFTING_ITEM_BASES.find((b) => b.id === baseId) ?? CRAFTING_ITEM_BASES[0];
  saveCraftingHistory();
  // Preserve the current item level rather than using base.itemLevel (which is equip requirement)
  const currentItemLevel = craftingState?.item?.itemLevel ?? 83;
  craftingState.item = createCraftedItem(base, currentItemLevel);
  craftingState.log.push({ action: 'select-base', result: `Selected ${base.name}` });
  craftingState.simulation = null;
  renderCraftingSimulator();
}

function updateCraftingItemLevel(value) {
  saveCraftingHistory();
  const level = clampCraftingNumber(value, 1, 100);
  craftingState.item.itemLevel = level;
  craftingState.item.base.itemLevel = level;
  craftingState.item.prefixes = craftingState.item.prefixes.filter((m) => m.requiredItemLevel <= level);
  craftingState.item.suffixes = craftingState.item.suffixes.filter((m) => m.requiredItemLevel <= level);
  craftingState.log.push({ action: 'item-level', result: `Set item level to ${level}` });
  renderCraftingSimulator();
}

function applyCraftingAction(action) {
  ensureCraftingState();
  const validation = validateCraftingAction(craftingState.item, action);
  if (!validation.ok) {
    craftingState.log.push({ action, result: `${craftingActionLabel(action)} failed: ${validation.reason}` });
    renderCraftingSimulator();
    return;
  }
  if (action === 'undo') {
    undoCraftingStep();
    return;
  }
  saveCraftingHistory();
  const item = craftingState.item;
  // Check if the active omen modifies this action
  const activeOmen = craftingState.activeOmen
    ? CRAFTING_OMENS.find((o) => o.id === craftingState.activeOmen)
    : null;
  const omenApplies = activeOmen && (activeOmen.modifiesAction ?? []).includes(action);
  const omenTag = omenApplies ? ` (${activeOmen.name})` : '';
  let result = '';
  if (action === 'reset') {
    craftingState.item = createCraftedItem(item.base, item.itemLevel);
    result = `Reset ${item.base.name} to Normal`;
  } else if (action === 'transmute') {
    item.rarity = 'magic';
    const added = addRandomModifier(item);
    result = `Used Orb of Transmutation: item became Magic${added ? ` and rolled ${formatModifierLine(added)}` : ''}`;
  } else if (action === 'augment') {
    const added = addRandomModifier(item);
    result = added ? `Used Orb of Augmentation: rolled ${formatModifierLine(added)}` : 'Orb of Augmentation found no valid modifier';
  } else if (action === 'regal') {
    item.rarity = 'rare';
    let forcedType = null;
    if (omenApplies && activeOmen.id === 'omen-sinistral-coronation') forcedType = 'prefix';
    if (omenApplies && activeOmen.id === 'omen-dextral-coronation') forcedType = 'suffix';
    const added = addRandomModifier(item, forcedType);
    result = `Used Regal Orb${omenTag}: item became Rare${added ? ` and rolled ${formatModifierLine(added)}` : ''}`;
  } else if (action === 'exalt') {
    if (omenApplies && activeOmen.id === 'omen-greater-exaltation') {
      const a1 = addRandomModifier(item);
      const a2 = addRandomModifier(item);
      result = `Used Exalted Orb${omenTag}: added${a1 ? ` ${formatModifierLine(a1)}` : ''}${a2 ? ` + ${formatModifierLine(a2)}` : ''}`;
    } else if (omenApplies && activeOmen.id === 'omen-sinistral-exaltation') {
      const added = addRandomModifier(item, 'prefix');
      result = `Used Exalted Orb${omenTag}: added prefix${added ? ` ${formatModifierLine(added)}` : ''}`;
    } else if (omenApplies && activeOmen.id === 'omen-dextral-exaltation') {
      const added = addRandomModifier(item, 'suffix');
      result = `Used Exalted Orb${omenTag}: added suffix${added ? ` ${formatModifierLine(added)}` : ''}`;
    } else {
      const added = addRandomModifier(item);
      result = added ? `Used Exalted Orb: rolled ${formatModifierLine(added)}` : 'Exalted Orb: no valid modifier available for this item type (all modifier groups already present)';
    }
  } else if (action === 'chaos') {
    if (omenApplies && activeOmen.id === 'omen-whittling') {
      // Remove modifier with lowest requiredItemLevel
      const mods = allExplicitModifiers(item);
      if (mods.length) {
        const lowest = mods.reduce((a, b) => ((a.requiredItemLevel ?? 0) <= (b.requiredItemLevel ?? 0) ? a : b));
        const list = lowest.type === 'prefix' ? item.prefixes : item.suffixes;
        const idx = list.findIndex((m) => m.rollId === lowest.rollId);
        if (idx >= 0) list.splice(idx, 1);
      }
      result = `Used Chaos Orb${omenTag}: removed lowest-level modifier`;
    } else if (omenApplies && activeOmen.id === 'omen-sinistral-erasure') {
      const removed = removeModifierOfType(item, 'prefix');
      result = `Used Chaos Orb${omenTag}: removed prefix${removed ? ` ${formatModifierLine(removed)}` : ''}`;
    } else if (omenApplies && activeOmen.id === 'omen-dextral-erasure') {
      const removed = removeModifierOfType(item, 'suffix');
      result = `Used Chaos Orb${omenTag}: removed suffix${removed ? ` ${formatModifierLine(removed)}` : ''}`;
    } else {
      rerollRareItem(item);
      result = `Used Chaos Orb: rerolled Rare item with ${item.prefixes.length + item.suffixes.length} modifiers`;
    }
  } else if (action === 'alchemy') {
    item.rarity = 'rare';
    if (omenApplies && activeOmen.id === 'omen-sinistral-alchemy') {
      item.prefixes = [];
      item.suffixes = [];
      for (let i = 0; i < 3; i += 1) addRandomModifier(item, 'prefix');
      for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i += 1) addRandomModifier(item, 'suffix');
    } else if (omenApplies && activeOmen.id === 'omen-dextral-alchemy') {
      item.prefixes = [];
      item.suffixes = [];
      for (let i = 0; i < 3; i += 1) addRandomModifier(item, 'suffix');
      for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i += 1) addRandomModifier(item, 'prefix');
    } else {
      rerollRareItem(item);
    }
    result = `Used Orb of Alchemy${omenTag}: item became Rare with ${item.prefixes.length + item.suffixes.length} modifiers`;
  } else if (action === 'annul') {
    if (omenApplies && activeOmen.id === 'omen-greater-annulment') {
      const r1 = removeRandomModifier(item);
      const r2 = removeRandomModifier(item);
      result = `Used Orb of Annulment${omenTag}: removed ${[r1, r2].filter(Boolean).map(formatModifierLine).join(' and ')}`;
    } else if (omenApplies && activeOmen.id === 'omen-sinistral-annulment') {
      const removed = removeModifierOfType(item, 'prefix');
      result = `Used Orb of Annulment${omenTag}: removed prefix${removed ? ` ${formatModifierLine(removed)}` : ''}`;
    } else if (omenApplies && activeOmen.id === 'omen-dextral-annulment') {
      const removed = removeModifierOfType(item, 'suffix');
      result = `Used Orb of Annulment${omenTag}: removed suffix${removed ? ` ${formatModifierLine(removed)}` : ''}`;
    } else {
      const removed = removeRandomModifier(item);
      result = removed ? `Used Orb of Annulment: removed ${formatModifierLine(removed)}` : 'Orb of Annulment had no modifier to remove';
    }
  } else if (action === 'chance') {
    result = 'Orb of Chance simulation is reserved for unique item data integration.';
  }
  // Consume the omen after it modifies an action
  if (omenApplies) craftingState.activeOmen = null;
  craftingState.log.push({ action, result });
  craftingState.simulation = null;
  renderCraftingSimulator();
}

function validateCraftingAction(item, action) {
  if (item.mirrored) {
    return { ok: false, reason: 'Item is mirrored — cannot modify.' };
  }
  
  // Sockets checks / corruption checks
  const isSocketAction = action === 'socket' || (typeof action === 'object' && action.type === 'socket');
  if (item.corrupted && action !== 'undo' && !isSocketAction) {
    return { ok: false, reason: 'Corruption already applied — cannot modify explicit properties.' };
  }

  // Handle action as string (for simple currency actions)
  if (typeof action === 'string') {
    if (action === 'undo') return craftingState?.history?.length ? { ok: true } : { ok: false, reason: 'No crafting step to undo.' };
    if (action === 'reset') return { ok: true };
    if (action === 'transmute' && item.rarity !== 'normal') return { ok: false, reason: 'Orb of Transmutation requires a Normal item.' };
    if (action === 'augment' && item.rarity !== 'magic') return { ok: false, reason: 'Orb of Augmentation requires a Magic item.' };
    if (action === 'augment' && !hasOpenModifierSlot(item)) return { ok: false, reason: 'Magic item already has full prefix/suffix slots.' };
    if (action === 'regal' && item.rarity !== 'magic') return { ok: false, reason: 'Regal Orb requires a Magic item.' };
    if (action === 'exalt' && item.rarity !== 'rare') return { ok: false, reason: 'Exalted Orb requires a Rare item.' };
    if (action === 'exalt' && !hasOpenModifierSlot(item)) return { ok: false, reason: 'Rare item has no open modifier slots.' };
    if (action === 'chaos' && item.rarity !== 'rare') return { ok: false, reason: 'Chaos Orb requires a Rare item.' };
    if (action === 'alchemy' && item.rarity !== 'normal') return { ok: false, reason: 'Orb of Alchemy requires a Normal item.' };
    if (action === 'annul' && !allExplicitModifiers(item).length) return { ok: false, reason: 'No explicit modifier can be removed.' };
    if (action === 'chance' && item.rarity !== 'normal') return { ok: false, reason: 'Orb of Chance requires a Normal item.' };
    return { ok: true };
  }

  // Handle action as object
  if (action.type === 'essence') {
    const essence = CRAFTING_ESSENCES.find(e => e.id === action.essenceId);
    if (!essence) return { ok: false, reason: 'Essence mod pool is missing.' };
    if (item.rarity === 'rare') return { ok: false, reason: 'Essence requires a Normal or Magic base.' };
    const baseTags = new Set(item.base.tags ?? []);
    const allowed = essence.allowedItemTags.some(t => baseTags.has(t));
    if (!allowed) return { ok: false, reason: 'Essence forced mod is not available for item class.' };
    return { ok: true };
  }

  if (action.type === 'omen') {
    const omen = CRAFTING_OMENS.find(o => o.id === action.omenId);
    if (!omen) return { ok: false, reason: 'Omen effects list missing.' };
    return { ok: true };
  }

  if (action.type === 'rune') {
    const rune = CRAFTING_RUNES.find(r => r.id === action.runeId);
    if (!rune) return { ok: false, reason: 'Rune compatibility pool missing.' };
    // Sockets check
    const currentSockets = String(item.properties?.["Sockets"] ?? "");
    const numSockets = currentSockets.split(" ").filter(Boolean).length;
    if (numSockets === 0) return { ok: false, reason: 'Item requires an open socket to apply Rune.' };
    const baseTags = new Set(item.base.tags ?? []);
    const isCompatible = (rune.effects ?? []).some(e => baseTags.has(e.itemType));
    if (!isCompatible) return { ok: false, reason: `Rune '${rune.name}' is incompatible with item category.` };
    return { ok: true };
  }

  if (action.type === 'soul_core') {
    const core = CRAFTING_SOUL_CORES.find(c => c.id === action.soulCoreId);
    if (!core) return { ok: false, reason: 'Soul Core data is missing.' };
    const baseTags = new Set(item.base.tags ?? []);
    const isCompatible = (core.effects ?? []).some(e => baseTags.has(e.itemType));
    if (!isCompatible) return { ok: false, reason: `Soul Core '${core.name}' is incompatible with item.` };
    return { ok: true };
  }

  if (action.type === 'abyss') {
    const abyssData = CRAFTING_ABYSS_DATA.find(a => a.id === action.abyssId);
    if (!abyssData) return { ok: false, reason: 'Abyss mechanic data is missing.' };
    const baseTags = new Set(item.base.tags ?? []);
    const isCompatible = abyssData.itemTypes.some(type => item.base.type === type) ||
                        abyssData.allowedBaseTags.some(tag => baseTags.has(tag));
    if (!isCompatible) {
      return { ok: false, reason: `Abyss mechanic '${abyssData.name}' is invalid for this item type.` };
    }
    return { ok: true };
  }

  if (action.type === 'desecration') {
    const desecration = CRAFTING_DESECRATION_DATA.find(d => d.id === action.desecrationId);
    if (!desecration) return { ok: false, reason: 'Desecration crafting data is missing.' };
    
    if (desecration.requiredRarity && !desecration.requiredRarity.includes(item.rarity)) {
      return { ok: false, reason: 'Desecration cannot be applied to this item rarity.' };
    }
    if (desecration.minItemLevel && item.itemLevel < desecration.minItemLevel) {
      return { ok: false, reason: 'Item level is too low for this Desecration craft.' };
    }
    const baseTags = new Set(item.base.tags ?? []);
    if (desecration.allowedItemTags.length > 0 && !desecration.allowedItemTags.some(tag => baseTags.has(tag))) {
      return { ok: false, reason: 'Desecration is not valid for this item base.' };
    }
    if (desecration.forbiddenItemTags?.some(tag => baseTags.has(tag))) {
      return { ok: false, reason: 'Desecration cannot be applied to this item type.' };
    }
    return { ok: true };
  }

  if (action.type === 'quality') {
    if (item.quality >= 20) return { ok: false, reason: 'Quality is already capped at +20%.' };
    return { ok: true };
  }

  if (action.type === 'corruption') {
    if (item.corrupted) return { ok: false, reason: 'Item is already corrupted.' };
    return { ok: true };
  }

  if (action.type === 'socket') {
    const currentSockets = String(item.properties?.["Sockets"] ?? "");
    const numSockets = currentSockets.split(" ").filter(Boolean).length;
    if (numSockets >= 4) return { ok: false, reason: 'Item already has maximum allowed socket count.' };
    return { ok: true };
  }

  return { ok: true };
}

function addRandomModifier(item, forcedType = null) {
  const openTypes = [];
  if ((!forcedType || forcedType === 'prefix') && item.prefixes.length < craftingPrefixLimit(item.rarity)) openTypes.push('prefix');
  if ((!forcedType || forcedType === 'suffix') && item.suffixes.length < craftingSuffixLimit(item.rarity)) openTypes.push('suffix');
  const pools = openTypes.map((type) => ({ type, pool: availableModifierPool(item, type) })).filter((p) => p.pool.length);
  if (!pools.length) return null;
  const bucket = pools[Math.floor(Math.random() * pools.length)];
  const mod = rollWeightedModifier(bucket.pool);
  if (!mod) return null;
  const rolled = randomizeModifierValues(mod);
  if (bucket.type === 'prefix') item.prefixes.push(rolled);
  else item.suffixes.push(rolled);
  return rolled;
}

function rerollRareItem(item) {
  item.prefixes = [];
  item.suffixes = [];
  const desired = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < desired; i += 1) {
    if (!addRandomModifier(item)) break;
  }
}

function removeRandomModifier(item) {
  const mods = allExplicitModifiers(item);
  if (!mods.length) return null;
  const picked = mods[Math.floor(Math.random() * mods.length)];
  const list = picked.type === 'prefix' ? item.prefixes : item.suffixes;
  const index = list.findIndex((m) => m.rollId === picked.rollId);
  if (index >= 0) list.splice(index, 1);
  return picked;
}

function removeModifierOfType(item, type) {
  const list = type === 'prefix' ? item.prefixes : item.suffixes;
  if (!list.length) return null;
  const index = Math.floor(Math.random() * list.length);
  return list.splice(index, 1)[0] ?? null;
}

function availableModifierPool(item, type) {
  const existingGroups = new Set(allExplicitModifiers(item).map((m) => m.group || m.id));
  return CRAFTING_MODIFIERS.filter((mod) =>
    mod.type === type &&
    mod.requiredItemLevel <= item.itemLevel &&
    validModifierForBase(mod, item.base, item.itemLevel) &&
    !existingGroups.has(mod.group || mod.id)
  );
}

function getDesecrationModifierPool(item, desecration) {
  const poolIds = desecration.modifierPoolIds ?? [];
  const modifiersList = CRAFTING_MODIFIERS || [];
  
  const existingGroups = new Set(allExplicitModifiers(item).map((m) => m.group || m.id));

  let pool = modifiersList.filter((mod) => {
    if (poolIds.length > 0 && !poolIds.includes(mod.id)) return false;
    if (mod.requiredItemLevel > item.itemLevel) return false;
    if (!mod.tags.some(tag => item.base.tags.includes(tag))) return false;
    if (existingGroups.has(mod.group || mod.id)) return false;
    
    // affix slot check
    const limit = craftingPrefixLimit(item.rarity);
    if (mod.type === 'prefix' && item.prefixes.length >= limit) return false;
    if (mod.type === 'suffix' && item.suffixes.length >= limit) return false;

    return true;
  });

  if (desecration.forcedModifierIds?.length) {
    pool = pool.filter((mod) => desecration.forcedModifierIds.includes(mod.id));
  }

  return pool;
}

function rollWeightedModifier(pool) {
  const total = pool.reduce((sum, mod) => sum + Math.max(0, Number(mod.weight) || 0), 0);
  if (!pool.length || total <= 0) return null;
  let roll = Math.random() * total;
  for (const mod of pool) {
    roll -= Math.max(0, Number(mod.weight) || 0);
    if (roll <= 0) return mod;
  }
  return pool[pool.length - 1] ?? null;
}

function validModifierForBase(mod, base, itemLevel) {
  if (mod.requiredItemLevel > itemLevel) return false;
  const baseTags = new Set(base.tags ?? []);
  const modTags = mod.tags ?? [];
  if (!modTags.length) return false;
  // Broad category tags that don't restrict item type on their own
  const BROAD = new Set(['weapon', 'armour', 'jewellery', 'flask', 'jewel', 'charm']);
  // Weapon items require specific subtype matching — prevents attack mods on caster weapons
  if (baseTags.has('weapon')) {
    const specific = modTags.filter((t) => !BROAD.has(t));
    // Mod has subtype tags (e.g. 'attack', 'caster', 'wand') → at least one must match
    if (specific.length > 0) return specific.some((t) => baseTags.has(t));
    // Mod only has broad tags (e.g. ['weapon'] for crit) → match on broad tag
    return modTags.some((t) => baseTags.has(t));
  }
  // Non-weapon items: any tag match is sufficient
  return modTags.some((t) => baseTags.has(t));
}

function randomizeModifierValues(mod) {
  const rolled = cloneCraftingValue(mod);
  rolled.rollId = `${mod.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  rolled.rolledValues = (mod.values ?? []).map((range) => {
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return min || 0;
    return Math.floor(min + Math.random() * (max - min + 1));
  });
  return rolled;
}

function formatModifierLine(mod) {
  let index = 0;
  return String(mod.text ?? mod.name ?? mod.id).replace(/\(([-+]?\d+)-([-+]?\d+)\)/g, () => String(mod.rolledValues?.[index++] ?? '$1'));
}

function allExplicitModifiers(item) {
  return [...(item.prefixes ?? []), ...(item.suffixes ?? [])];
}

function hasOpenModifierSlot(item) {
  return item.prefixes.length < craftingPrefixLimit(item.rarity) || item.suffixes.length < craftingSuffixLimit(item.rarity);
}

function craftingPrefixLimit(rarity) {
  if (rarity === 'normal') return 0;
  if (rarity === 'magic') return 1;
  return 3;
}

function craftingSuffixLimit(rarity) {
  return craftingPrefixLimit(rarity);
}

function saveCraftingHistory() {
  craftingState.history.push({
    item: cloneCraftingValue(craftingState.item),
    log: cloneCraftingValue(craftingState.log),
    simulation: cloneCraftingValue(craftingState.simulation),
  });
  if (craftingState.history.length > 50) craftingState.history.shift();
}

function undoCraftingStep() {
  const previous = craftingState.history.pop();
  if (!previous) return;
  craftingState.item = previous.item;
  craftingState.log = previous.log;
  craftingState.simulation = previous.simulation;
  craftingState.log.push({ action: 'undo', result: 'Undid last crafting step' });
  renderCraftingSimulator();
}

function updateCraftingTarget(field, value) {
  ensureCraftingState();
  craftingState.target[field] = field === 'minTier' ? Number(value) : value;
  craftingState.simulation = null;
  renderCraftingSimulator();
}

function simulateTargetCrafts(count) {
  ensureCraftingState();
  const target = CRAFTING_MODIFIERS.find((m) => m.id === craftingState.target.modId) ||
                 [
                   { id: "corruption-implicit-1", name: "Corrupted Implicit", text: "+1 to Level of socketed Skill Gems", type: "implicit" },
                   { id: "corruption-implicit-2", name: "Corrupted Implicit", text: "+5% to maximum Fire Resistance", type: "implicit" },
                   { id: "corruption-implicit-3", name: "Corrupted Implicit", text: "4% increased maximum Life", type: "implicit" }
                 ].find(c => c.id === craftingState.target.modId);
                 
  if (!target) {
    craftingState.log.push({ action: 'simulate', result: 'Choose a target modifier before simulating.' });
    renderCraftingSimulator();
    return;
  }

  const strategy = craftingState.target.strategy ?? 'alchemy';
  let successes = 0;
  let bestItem = null;
  
  // Track spent currencies
  const spent = {
    transmute: 0,
    augment: 0,
    regal: 0,
    exalt: 0,
    chaos: 0,
    alchemy: 0,
    essence: 0,
    vaal: 0,
    abyss: 0,
    soulCore: 0,
    rune: 0,
    desecration: 0,
  };

  for (let i = 0; i < count; i += 1) {
    const item = createCraftedItem(craftingState.item.base, craftingState.item.itemLevel);
    
    if (strategy === 'transmute') {
      item.rarity = 'magic';
      addRandomModifier(item);
      spent.transmute += 1;
      
      if (hasOpenModifierSlot(item)) {
        addRandomModifier(item);
        spent.augment += 1;
      }
      
      item.rarity = 'rare';
      addRandomModifier(item);
      spent.regal += 1;
    } 
    else if (strategy === 'chaos') {
      item.rarity = 'rare';
      rerollRareItem(item);
      spent.chaos += 1;
    } 
    else if (strategy === 'alchemy' || strategy === 'alchemy_chaos') {
      item.rarity = 'rare';
      rerollRareItem(item);
      spent.alchemy += 1;
    } 
    else if (strategy === 'essence') {
      item.rarity = 'rare';
      spent.essence += 1;
      
      const essenceId = craftingState.selectedEssence;
      const essence = CRAFTING_ESSENCES.find(e => e.id === essenceId);
      if (essence) {
        const baseTags = new Set(item.base.tags ?? []);
        let bestFm = null;
        let bestScore = 0;
        for (const fm of essence.forcedMods) {
          const score = fm.itemTags.filter((t) => baseTags.has(t)).length;
          if (score > bestScore) { bestScore = score; bestFm = fm; }
        }
        let forcedType = 'prefix';
        if (bestFm) {
          const txt = bestFm.modText.toLowerCase();
          if (txt.includes('resistance') || txt.includes('% to critical') || txt.includes('cast speed') || txt.includes('attack speed') || txt.includes('movement speed')) {
            forcedType = 'suffix';
          }
          const ranges = [...bestFm.modText.matchAll(/\((\d+\.?\d*)-(\d+\.?\d*)\)/g)]
            .map((m) => ({ min: Number(m[1]), max: Number(m[2]) }));
          const forcedMod = randomizeModifierValues({
            id: `essence-forced-${essence.id}-${Date.now()}`,
            group: `essence-forced-${essence.id}`,
            name: essence.name,
            text: bestFm.modText,
            type: forcedType,
            tier: 1,
            weight: 1,
            requiredItemLevel: 1,
            tags: [],
            values: ranges,
          });
          if (forcedType === 'prefix') item.prefixes.push(forcedMod);
          else item.suffixes.push(forcedMod);
        }
        const desired = 4;
        const remaining = desired - (bestFm ? 1 : 0);
        for (let j = 0; j < remaining; j++) {
          if (!addRandomModifier(item)) break;
        }
      } else {
        rerollRareItem(item);
      }
    } 
    else if (strategy === 'exalt') {
      item.rarity = 'rare';
      for (let j = 0; j < 4; j++) {
        addRandomModifier(item);
      }
      if (hasOpenModifierSlot(item)) {
        addRandomModifier(item);
      }
      spent.exalt += 1;
    } 
    else if (strategy === 'corruption') {
      item.rarity = 'rare';
      rerollRareItem(item);
      item.corrupted = true;
      spent.vaal += 1;
      
      const corruptionImplicits = [
        { id: "corruption-implicit-1", name: "Corrupted Implicit", text: "+1 to Level of socketed Skill Gems", type: "implicit", tags: ["weapon", "armour"] },
        { id: "corruption-implicit-2", name: "Corrupted Implicit", text: "+5% to maximum Fire Resistance", type: "implicit", tags: ["armour"] },
        { id: "corruption-implicit-3", name: "Corrupted Implicit", text: "4% increased maximum Life", type: "implicit", tags: ["armour", "jewellery"] }
      ];
      const baseTags = new Set(item.base.tags ?? []);
      const validImplicits = corruptionImplicits.filter((mod) =>
        mod.tags.some((tag) => baseTags.has(tag))
      );
      const chosen = validImplicits.length > 0
        ? validImplicits[Math.floor(Math.random() * validImplicits.length)]
        : corruptionImplicits[0];

      const rolledImplicit = {
        ...chosen,
        id: `corruption-implicit-${Date.now()}`,
        rolledValues: []
      };
      item.implicits = item.implicits ?? [];
      item.implicits.push(rolledImplicit);
    }
    else if (strategy === 'abyss') {
      item.rarity = 'rare';
      spent.abyss += 1;
      
      const abyssId = craftingState.selectedAbyss;
      const abyssData = CRAFTING_ABYSS_DATA.find(a => a.id === abyssId);
      if (abyssData) {
        if (abyssData.socketBehavior === "adds_socket") {
          item.base.name = "Stygian Vise";
          if (!item.base.tags.includes("abyss_socket")) {
            item.base.tags.push("abyss_socket");
          }
        }
        if (abyssData.forcedMods && abyssData.forcedMods.length > 0) {
          for (const text of abyssData.forcedMods) {
            const newMod = {
              id: `abyss-forced-${Date.now()}-${Math.random()}`,
              name: "Abyssal Modifier",
              text,
              type: "prefix",
              weight: 1,
              requiredItemLevel: 1,
              tags: ["jewel"]
            };
            item.prefixes.push(newMod);
          }
        }
      }
      rerollRareItem(item);
    }
    else if (strategy === 'desecration') {
      const desecrationId = craftingState.selectedDesecration;
      const desecration = CRAFTING_DESECRATION_DATA.find(d => d.id === desecrationId);
      if (desecration) {
        const valRes = validateCraftingAction(item, { type: 'desecration', desecrationId });
        if (valRes.ok) {
          spent.desecration += 1;
          const pool = getDesecrationModifierPool(item, desecration);
          if (desecration.addsModifiers && pool.length > 0) {
            const mod = rollWeightedModifier(pool);
            if (mod) {
              const rolled = randomizeModifierValues(mod);
              if (mod.type === 'prefix') item.prefixes.push(rolled);
              else item.suffixes.push(rolled);
            }
          }
        }
      }
    }
    else if (strategy === 'desecration_exalt') {
      const desecrationId = craftingState.selectedDesecration;
      const desecration = CRAFTING_DESECRATION_DATA.find(d => d.id === desecrationId);
      if (desecration) {
        const valRes = validateCraftingAction(item, { type: 'desecration', desecrationId });
        if (valRes.ok) {
          spent.desecration += 1;
          const pool = getDesecrationModifierPool(item, desecration);
          if (desecration.addsModifiers && pool.length > 0) {
            const mod = rollWeightedModifier(pool);
            if (mod) {
              const rolled = randomizeModifierValues(mod);
              if (mod.type === 'prefix') item.prefixes.push(rolled);
              else item.suffixes.push(rolled);
            }
          }
        }
      }
      if (item.rarity !== 'rare') {
        item.rarity = 'rare';
      }
      if (hasOpenModifierSlot(item)) {
        addRandomModifier(item);
        spent.exalt += 1;
      }
    }
    else if (strategy === 'desecration_chaos') {
      const desecrationId = craftingState.selectedDesecration;
      const desecration = CRAFTING_DESECRATION_DATA.find(d => d.id === desecrationId);
      if (desecration) {
        const valRes = validateCraftingAction(item, { type: 'desecration', desecrationId });
        if (valRes.ok) {
          spent.desecration += 1;
          const pool = getDesecrationModifierPool(item, desecration);
          if (desecration.addsModifiers && pool.length > 0) {
            const mod = rollWeightedModifier(pool);
            if (mod) {
              const rolled = randomizeModifierValues(mod);
              if (mod.type === 'prefix') item.prefixes.push(rolled);
              else item.suffixes.push(rolled);
            }
          }
        }
      }
      if (item.rarity !== 'rare') {
        item.rarity = 'rare';
      }
      rerollRareItem(item);
      spent.chaos += 1;
    }
    else if (strategy === 'desecration_assisted') {
      item.rarity = 'magic';
      addRandomModifier(item);
      spent.transmute += 1;
      if (hasOpenModifierSlot(item)) {
        addRandomModifier(item);
        spent.augment += 1;
      }
      item.rarity = 'rare';
      addRandomModifier(item);
      spent.regal += 1;

      const desecrationId = craftingState.selectedDesecration;
      const desecration = CRAFTING_DESECRATION_DATA.find(d => d.id === desecrationId);
      if (desecration) {
        const valRes = validateCraftingAction(item, { type: 'desecration', desecrationId });
        if (valRes.ok) {
          spent.desecration += 1;
          const pool = getDesecrationModifierPool(item, desecration);
          if (desecration.addsModifiers && pool.length > 0) {
            const mod = rollWeightedModifier(pool);
            if (mod) {
              const rolled = randomizeModifierValues(mod);
              if (mod.type === 'prefix') item.prefixes.push(rolled);
              else item.suffixes.push(rolled);
            }
          }
        }
      }
    }
    else if (strategy === 'rune_soul') {
      item.rarity = 'rare';
      rerollRareItem(item);
      
      const coreId = craftingState.selectedSoulCore;
      const core = CRAFTING_SOUL_CORES.find(c => c.id === coreId);
      if (core) {
        spent.soulCore += 1;
        const baseTags = new Set(item.base.tags ?? []);
        const effect = (core.effects ?? []).find((e) => baseTags.has(e.itemType)) ?? (core.effects ?? [])[0];
        const newMod = {
          id: `soul-core-${core.id}-${Date.now()}`,
          name: core.name,
          text: effect?.text ?? core.description,
          type: "implicit",
          weight: 1,
          requiredItemLevel: 1,
          tags: []
        };
        item.implicits.push(newMod);
      }
      
      const runeId = craftingState.selectedRune;
      const rune = CRAFTING_RUNES.find(r => r.id === runeId);
      if (rune) {
        spent.rune += 1;
        const baseTags = new Set(item.base.tags ?? []);
        const effect = (rune.effects ?? []).find((e) => baseTags.has(e.itemType)) ?? (rune.effects ?? [])[0];
        const newMod = {
          id: `rune-${rune.id}-${Date.now()}`,
          name: rune.name,
          text: effect?.text ?? rune.description,
          type: "implicit",
          weight: 1,
          requiredItemLevel: 1,
          tags: []
        };
        item.implicits.push(newMod);
      }
    }

    const allMods = [...item.implicits, ...item.prefixes, ...item.suffixes];
    const hit = allMods.some((mod) => mod.id === target.id || mod.text === target.text || (mod.name === target.name && (!target.tier || mod.tier <= Number(craftingState.target.minTier || 5))));
    
    if (hit) {
      successes += 1;
      if (!bestItem) bestItem = item;
    }
  }

  const totalSpentArr = [];
  if (spent.alchemy) totalSpentArr.push(`${spent.alchemy} Alchemy`);
  if (spent.chaos) totalSpentArr.push(`${spent.chaos} Chaos`);
  if (spent.transmute) totalSpentArr.push(`${spent.transmute} Transmute`);
  if (spent.augment) totalSpentArr.push(`${spent.augment} Augment`);
  if (spent.regal) totalSpentArr.push(`${spent.regal} Regal`);
  if (spent.exalt) totalSpentArr.push(`${spent.exalt} Exalted`);
  if (spent.essence) totalSpentArr.push(`${spent.essence} Essence`);
  if (spent.vaal) totalSpentArr.push(`${spent.vaal} Vaal`);
  if (spent.abyss) totalSpentArr.push(`${spent.abyss} Abyss`);
  if (spent.desecration) totalSpentArr.push(`${spent.desecration} Desecration`);
  if (spent.soulCore) totalSpentArr.push(`${spent.soulCore} Soul Core`);
  if (spent.rune) totalSpentArr.push(`${spent.rune} Rune`);
  
  const spentString = totalSpentArr.length > 0 ? totalSpentArr.join(', ') : 'none';

  craftingState.simulation = {
    attempts: count,
    successes,
    chance: count ? (successes / count) * 100 : 0,
    averageCurrency: successes ? count / successes : 0,
    bestItem,
    spentString,
  };

  craftingState.log.push({ 
    action: 'simulate', 
    result: `Simulated ${count} ${strategy} crafts: ${successes} hit ${target.name || target.text} (spent: ${spentString})` 
  });
  renderCraftingSimulator();
}

async function copyCraftedItemJson() {
  ensureCraftingState();
  await clipboardWrite(JSON.stringify(craftingState.item, null, 2));
}

function exportCraftedItemToBuild() {
  ensureCraftingState();
  if (!lastBuild) {
    lastBuild = { name: 'Crafted Item Build', description: 'Created from the Crafting Simulator.', items: [], skills: [], passives: [] };
    lastData = lastData ?? { report: { converted: [], guessed: [], unsupported: [], warnings: [] }, source: { kind: 'Crafting Simulator' }, passiveNames: {}, passiveAscendancies: {}, ascendancyNames: {} };
  }
  lastBuild.items = lastBuild.items ?? [];
  lastBuild.items.push(craftedItemToBuildItem(craftingState.item));
  craftingState.log.push({ action: 'export', result: `Sent ${craftedItemName(craftingState.item)} to Items tab` });
  rerenderEditablePanels();
  renderCraftingSimulator();
  if ($('tab-items')) switchTab('items');
}

function craftedItemToBuildItem(item) {
  return {
    inventory_id: inferCraftedItemSlot(item.base),
    unique_name: craftedItemName(item),
    base_type: item.base.name,
    level_interval: [0, 100],
    additional_text: craftedItemText(item),
    crafting: cloneCraftingValue(item),
  };
}

function craftedItemText(item) {
  const lines = [
    `Rarity: ${titleCase(item.rarity)}`,
    craftedItemName(item),
    item.base.name,
    `Quality: +${item.quality}%`,
    `Item Level: ${item.itemLevel}`,
  ];
  for (const mod of item.implicits) lines.push(formatModifierLine(mod));
  for (const mod of item.prefixes) lines.push(formatModifierLine(mod));
  for (const mod of item.suffixes) lines.push(formatModifierLine(mod));
  return lines.join('\n');
}

function craftedItemName(item) {
  if (item.rarity === 'normal') return item.base.name;
  if (item.rarity === 'magic') return `${item.prefixes[0]?.name || item.suffixes[0]?.name || 'Magic'} ${item.base.name}`;
  const first = item.prefixes[0]?.name || 'Crafted';
  const second = item.suffixes[0]?.name || 'Relic';
  return `${first} ${second}`;
}

function inferCraftedItemSlot(base) {
  if (base.type === 'helmet') return 'Helm';
  if (base.type === 'body armour') return 'BodyArmour';
  if (base.type === 'gloves') return 'Gloves';
  if (base.type === 'boots') return 'Boots';
  if (base.type === 'ring') return 'Ring';
  if (base.type === 'amulet') return 'Amulet';
  if (base.type === 'belt') return 'Belt';
  if (base.category === 'Flask/Charm') return 'Flask1';
  return 'Weapon';
}

function getCraftingWarnings() {
  if (!craftingState?.item) return ['Crafting simulator has not initialized.'];
  const item = craftingState.item;
  const warnings = [...(craftingState.warnings ?? [])];
  
  if (item.prefixes.length > 3) warnings.push('Impossible item state: more than 3 prefixes.');
  if (item.suffixes.length > 3) warnings.push('Impossible item state: more than 3 suffixes.');
  if (item.rarity === 'magic' && (item.prefixes.length > 1 || item.suffixes.length > 1)) warnings.push('Magic item has too many explicit modifiers.');
  
  for (const mod of allExplicitModifiers(item)) {
    if (!validModifierForBase(mod, item.base, item.itemLevel)) {
      warnings.push(`${mod.name} is invalid for ${item.base.name} at item level ${item.itemLevel}.`);
    }
  }

  // Socket requirements check
  const currentSockets = String(item.properties?.["Sockets"] ?? "");
  const numSockets = currentSockets.split(" ").filter(Boolean).length;

  if (craftingState.method === 'soul_core') {
    if (!craftingState.selectedSoulCore) {
      warnings.push("Soul Core data is missing.");
    } else {
      const core = CRAFTING_SOUL_CORES.find(c => c.id === craftingState.selectedSoulCore);
      if (!core) {
        warnings.push("Unknown crafting mechanic.");
      } else {
        const baseTags = new Set(item.base.tags ?? []);
        const isCompatible = (core.effects ?? []).some(e => baseTags.has(e.itemType));
        if (!isCompatible) {
          warnings.push(`Soul Core '${core.name}' is incompatible with item.`);
        }
        if (!core.dataComplete) {
          warnings.push(`Soul Core '${core.name}' has incomplete database coverage.`);
        }
      }
    }
  }

  if (craftingState.method === 'abyss') {
    if (!craftingState.selectedAbyss) {
      warnings.push("Abyss mechanic data is missing.");
    } else {
      const abyss = CRAFTING_ABYSS_DATA.find(a => a.id === craftingState.selectedAbyss);
      if (!abyss) {
        warnings.push("Unknown crafting mechanic.");
      } else {
        const baseTags = new Set(item.base.tags ?? []);
        const isCompatible = abyss.itemTypes.some(type => item.base.type === type) ||
                            abyss.allowedBaseTags.some(tag => baseTags.has(tag));
        if (!isCompatible) {
          warnings.push(`Abyss mechanic '${abyss.name}' is invalid for this item type.`);
        }
        if (!abyss.dataComplete) {
          warnings.push(`Abyss mechanic '${abyss.name}' is only partially supported.`);
        }
      }
    }
  }

  if (craftingState.method === 'desecration') {
    if (!craftingState.selectedDesecration) {
      warnings.push("Desecration crafting data is missing.");
    } else {
      const desecration = CRAFTING_DESECRATION_DATA.find(d => d.id === craftingState.selectedDesecration);
      if (!desecration) {
        warnings.push("Unknown crafting mechanic.");
      } else {
        if (!desecration.dataComplete) {
          warnings.push("Desecration crafting data is incomplete. Verify behavior against real PoE2 data.");
        }
        if (desecration.requiredRarity && !desecration.requiredRarity.includes(item.rarity)) {
          warnings.push("Desecration cannot be applied to this item rarity.");
        }
        if (desecration.minItemLevel && item.itemLevel < desecration.minItemLevel) {
          warnings.push("Item level is too low for this Desecration craft.");
        }
        const baseTags = new Set(item.base.tags ?? []);
        if (desecration.allowedItemTags.length > 0 && !desecration.allowedItemTags.some(tag => baseTags.has(tag))) {
          warnings.push("Desecration is not valid for this item base.");
        }
        if (desecration.forbiddenItemTags?.some(tag => baseTags.has(tag))) {
          warnings.push("Desecration cannot be applied to this item type.");
        }
        const pool = getDesecrationModifierPool(item, desecration);
        if (desecration.addsModifiers && pool.length === 0) {
          warnings.push("No valid Desecration modifier pool found. No modifier was added.");
        }
      }
    }
  }

  if (craftingState.method === 'rune') {
    if (craftingState.selectedRune) {
      const rune = CRAFTING_RUNES.find(r => r.id === craftingState.selectedRune);
      if (rune) {
        const baseTags = new Set(item.base.tags ?? []);
        const isCompatible = (rune.effects ?? []).some(e => baseTags.has(e.itemType));
        if (!isCompatible) {
          warnings.push(`Rune '${rune.name}' is incompatible with item category.`);
        }
        if (numSockets === 0) {
          warnings.push("Item requires an open socket to apply Rune.");
        }
      }
    }
  }

  if (craftingState.method === 'quality') {
    if (item.quality >= 20) {
      warnings.push("Quality is already capped at +20%.");
    }
  }

  if (craftingState.method === 'corruption') {
    if (item.corrupted) {
      warnings.push("Item is already corrupted.");
    }
  }

  if (craftingState.method === 'socket') {
    if (numSockets >= 4) {
      warnings.push("Item already has maximum allowed socket count.");
    }
  }

  return uniqueValues(warnings);
}

function refreshProblemsAfterCraftingChange() {
  if (!lastData?.report || !$('tab-problems')) return;
  renderProblemsTab(lastData.report);
  const warningList = getCraftingWarnings();
  if (warningList.length) {
    $('tab-problems').insertAdjacentHTML('beforeend', `
      <div class="problems-section ph-warnings">
        <h3>Crafting (${warningList.length})</h3>
        <ul>${warningList.map((warning) => `<li>${esc(warning)}</li>`).join('')}</ul>
      </div>`);
  }
  const issues = (lastData.report.guessed?.length ?? 0) + (lastData.report.unsupported?.length ?? 0) + getCraftingWarnings().length;
  const badge = $('problems-badge');
  if (badge) {
    badge.textContent = issues;
    badge.classList.toggle('hidden', issues === 0);
  }
}

function craftingActionLabel(action) {
  return ({
    transmute: 'Orb of Transmutation',
    augment: 'Orb of Augmentation',
    regal: 'Regal Orb',
    exalt: 'Exalted Orb',
    chaos: 'Chaos Orb',
    alchemy: 'Orb of Alchemy',
    annul: 'Orb of Annulment',
    chance: 'Orb of Chance',
    reset: 'Reset Item',
    undo: 'Undo Last Step',
  })[action] || action;
}

function cloneCraftingValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function clampCraftingNumber(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function uniqueValues(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ''))];
}

function titleCase(value) {
  return String(value ?? '').replace(/\b\w/g, (char) => char.toUpperCase());
}

function updateCraftingMethod(method) {
  ensureCraftingState();
  craftingState.method = method;
  renderCraftingSimulator();
}

function updateCraftingEssenceSelection(essenceId) {
  ensureCraftingState();
  craftingState.selectedEssence = essenceId;
  renderCraftingSimulator();
}

function updateCraftingOmenSelection(omenId) {
  ensureCraftingState();
  craftingState.activeOmen = omenId || null;
  renderCraftingSimulator();
}

function updateCraftingRuneSelection(runeId) {
  ensureCraftingState();
  craftingState.selectedRune = runeId || null;
  renderCraftingSimulator();
}

function updateCraftingSoulCoreSelection(soulCoreId) {
  ensureCraftingState();
  craftingState.selectedSoulCore = soulCoreId;
  renderCraftingSimulator();
}

function updateCraftingAbyssSelection(abyssId) {
  ensureCraftingState();
  craftingState.selectedAbyss = abyssId;
  renderCraftingSimulator();
}

function updateCraftingDesecrationSelection(desecrationId) {
  ensureCraftingState();
  craftingState.selectedDesecration = desecrationId;
  renderCraftingSimulator();
}

function updateCraftingQualitySelection(qualityId) {
  ensureCraftingState();
  craftingState.selectedQuality = qualityId;
  renderCraftingSimulator();
}

function updateCraftingCorruptionSelection(corruptionId) {
  ensureCraftingState();
  craftingState.selectedCorruption = corruptionId;
  renderCraftingSimulator();
}

function updateCraftingSocketSelection(socketCraftId) {
  ensureCraftingState();
  craftingState.selectedSocketCraft = socketCraftId;
  renderCraftingSimulator();
}

function applyCraftingRune() {
  ensureCraftingState();
  const runeId = craftingState.selectedRune;
  const rune = CRAFTING_RUNES.find((r) => r.id === runeId);
  if (!rune) {
    craftingState.log.push({ action: 'rune', result: 'No rune selected.' });
    renderCraftingSimulator();
    return;
  }
  const item = craftingState.item;
  const maxRunes = 4;
  if ((item.runes ?? []).length >= maxRunes) {
    craftingState.log.push({ action: 'rune', result: `Cannot socket more than ${maxRunes} runes.` });
    renderCraftingSimulator();
    return;
  }
  // Pick effect for this item type (weapon vs armour)
  const baseTags = new Set(item.base.tags ?? []);
  const effect = (rune.effects ?? []).find((e) => baseTags.has(e.itemType)) ?? (rune.effects ?? [])[0];
  saveCraftingHistory();
  item.runes = item.runes ?? [];
  item.runes.push({
    id: rune.id,
    name: rune.name,
    text: effect?.text ?? rune.description,
    rollId: `rune-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  craftingState.log.push({ action: 'rune', result: `Socketed ${rune.name}: ${effect?.text ?? rune.description}` });
  renderCraftingSimulator();
}

function applyCraftingEssence() {
  ensureCraftingState();
  const essenceId = craftingState.selectedEssence;
  const essence = CRAFTING_ESSENCES.find((e) => e.id === essenceId);
  if (!essence) {
    craftingState.log.push({ action: 'essence', result: 'No essence selected.' });
    renderCraftingSimulator();
    return;
  }
  const item = craftingState.item;
  const baseTags = new Set(item.base.tags ?? []);
  // Validate: essence must be compatible with this item type
  const allowed = (essence.allowedItemTags ?? []).some((t) => baseTags.has(t));
  if (!allowed) {
    craftingState.log.push({ action: 'essence', result: `${essence.name} cannot be applied to ${item.base.name} — incompatible item type.` });
    renderCraftingSimulator();
    return;
  }
  // Validate: item must be Normal or Magic (not Rare or corrupted)
  if (item.rarity === 'rare') {
    craftingState.log.push({ action: 'essence', result: `${essence.name} requires a Normal or Magic item.` });
    renderCraftingSimulator();
    return;
  }
  if (item.corrupted) {
    craftingState.log.push({ action: 'essence', result: 'Cannot use essence on a corrupted item.' });
    renderCraftingSimulator();
    return;
  }
  saveCraftingHistory();
  item.rarity = 'rare';
  item.prefixes = [];
  item.suffixes = [];
  // Find the best matching forcedMod — pick the entry with the most matching tags
  // (avoids broad 'weapon' tag matching when a specific 'caster'/'attack' entry exists)
  let bestFm = null;
  let bestScore = 0;
  for (const fm of essence.forcedMods) {
    const score = fm.itemTags.filter((t) => baseTags.has(t)).length;
    if (score > bestScore) { bestScore = score; bestFm = fm; }
  }
  // Determine forced mod prefix vs suffix by text keywords
  let forcedType = 'prefix';
  if (bestFm) {
    const txt = bestFm.modText.toLowerCase();
    if (txt.includes('resistance') || txt.includes('% to critical') || txt.includes('cast speed') || txt.includes('attack speed') || txt.includes('movement speed')) {
      forcedType = 'suffix';
    }
  }
  // Add forced mod FIRST to guarantee its slot, then fill remaining with random mods
  if (bestFm) {
    const ranges = [...bestFm.modText.matchAll(/\((\d+\.?\d*)-(\d+\.?\d*)\)/g)]
      .map((m) => ({ min: Number(m[1]), max: Number(m[2]) }));
    const forcedMod = randomizeModifierValues({
      id: `essence-forced-${essence.id}-${Date.now()}`,
      group: `essence-forced-${essence.id}`,
      name: essence.name,
      text: bestFm.modText,
      type: forcedType,
      tier: 1,
      weight: 1,
      requiredItemLevel: 1,
      tags: [],
      values: ranges,
    });
    if (forcedType === 'prefix') item.prefixes.push(forcedMod);
    else item.suffixes.push(forcedMod);
  }
  // Fill remaining slots with random mods (up to 3–5 total)
  const desired = 3 + Math.floor(Math.random() * 3);
  const remaining = desired - 1; // one slot used by forced mod (or zero if none)
  for (let i = 0; i < (bestFm ? remaining : desired); i += 1) {
    if (!addRandomModifier(item)) break;
  }
  const forcedDisplay = bestFm ? formatModifierLine({ text: bestFm.modText, rolledValues: item[forcedType === 'prefix' ? 'prefixes' : 'suffixes'][0]?.rolledValues ?? [] }) : 'none';
  craftingState.log.push({ action: 'essence', result: `Used ${essence.name}: Rare item with forced ${forcedType} "${bestFm?.modText ?? 'none'}"` });
  craftingState.simulation = null;
  renderCraftingSimulator();
}

function applyCraftingSoulCore() {
  ensureCraftingState();
  const soulCoreId = craftingState.selectedSoulCore;
  const core = CRAFTING_SOUL_CORES.find((c) => c.id === soulCoreId);
  if (!core) {
    craftingState.log.push({ action: 'soul_core', result: 'No soul core selected.' });
    renderCraftingSimulator();
    return;
  }
  const item = craftingState.item;
  const valRes = validateCraftingAction(item, { type: 'soul_core', soulCoreId });
  if (!valRes.ok) {
    craftingState.log.push({ action: 'soul_core', result: `Soul Core failed: ${valRes.reason}` });
    renderCraftingSimulator();
    return;
  }
  saveCraftingHistory();
  const baseTags = new Set(item.base.tags ?? []);
  const effect = (core.effects ?? []).find((e) => baseTags.has(e.itemType)) ?? (core.effects ?? [])[0];

  const newMod = {
    id: `soul-core-${core.id}-${Date.now()}`,
    name: core.name,
    text: effect?.text ?? core.description,
    type: "implicit",
    weight: 1,
    requiredItemLevel: 1,
    tags: []
  };

  item.implicits = item.implicits ?? [];
  item.implicits.push(newMod);

  let msg = `Used Soul Core: Socketed ${core.name} on ${item.base.name} adding implicit: "${newMod.text}"`;
  if (!core.dataComplete) {
    msg += " (Partial data warning)";
  }
  craftingState.log.push({ action: 'soul_core', result: msg });
  renderCraftingSimulator();
}

function applyAbyssMechanic() {
  ensureCraftingState();
  const abyssId = craftingState.selectedAbyss;
  const abyssData = CRAFTING_ABYSS_DATA.find((a) => a.id === abyssId);
  if (!abyssData) {
    craftingState.log.push({ action: 'abyss', result: 'No Abyss mechanic selected.' });
    renderCraftingSimulator();
    return;
  }
  const item = craftingState.item;
  const valRes = validateCraftingAction(item, { type: 'abyss', abyssId });
  if (!valRes.ok) {
    craftingState.log.push({ action: 'abyss', result: `Abyss craft failed: ${valRes.reason}` });
    renderCraftingSimulator();
    return;
  }
  saveCraftingHistory();
  
  if (abyssData.socketBehavior === "adds_socket") {
    item.base.name = "Stygian Vise";
    if (!item.base.tags.includes("abyss_socket")) {
      item.base.tags.push("abyss_socket");
    }
  }

  if (abyssData.forcedMods && abyssData.forcedMods.length > 0) {
    item.prefixes = item.prefixes ?? [];
    for (const text of abyssData.forcedMods) {
      const newMod = {
        id: `abyss-forced-${Date.now()}-${Math.random()}`,
        name: "Abyssal Modifier",
        text,
        type: "prefix",
        weight: 1,
        requiredItemLevel: 1,
        tags: ["jewel"]
      };
      item.prefixes.push(newMod);
    }
  }

  let msg = `Used Abyss mechanic: '${abyssData.name}' applied to item.`;
  if (!abyssData.dataComplete) {
    msg += " (Partial data warning)";
  }
  craftingState.log.push({ action: 'abyss', result: msg });
  renderCraftingSimulator();
}

function applyDesecrationMechanic() {
  ensureCraftingState();
  const desecrationId = craftingState.selectedDesecration;
  const desecration = CRAFTING_DESECRATION_DATA.find((d) => d.id === desecrationId);
  if (!desecration) {
    craftingState.log.push({ action: 'desecration', result: 'No Desecration mechanic selected.' });
    renderCraftingSimulator();
    return;
  }
  const item = craftingState.item;
  const valRes = validateCraftingAction(item, { type: 'desecration', desecrationId });
  if (!valRes.ok) {
    craftingState.log.push({ action: 'desecration', result: `Desecration failed: ${valRes.reason}` });
    renderCraftingSimulator();
    return;
  }
  saveCraftingHistory();

  let nextItem = cloneCraftingValue(item);
  const addedMods = [];
  const removedMods = [];

  const validPool = getDesecrationModifierPool(nextItem, desecration);

  if (desecration.addsModifiers && validPool.length > 0) {
    const mod = rollWeightedModifier(validPool);
    if (mod) {
      const rolled = randomizeModifierValues(mod);
      if (mod.type === 'prefix') nextItem.prefixes.push(rolled);
      else nextItem.suffixes.push(rolled);
      addedMods.push(rolled);
    }
  }

  craftingState.item = nextItem;

  let msg = '';
  if (addedMods.length > 0) {
    msg = `Used Desecration: added ${addedMods.map(m => m.text).join(", ")}.`;
  } else if (desecration.addsModifiers && validPool.length === 0) {
    msg = "Used Desecration: no valid modifier was applied. (No valid modifier pool)";
  } else {
    msg = "Used Desecration: no valid modifier was applied.";
  }

  if (!desecration.dataComplete) {
    msg += " (Incomplete data warning)";
  }

  craftingState.log.push({ action: 'desecration', result: msg });
  renderCraftingSimulator();
}

function applyQualityMechanic() {
  ensureCraftingState();
  const qualityId = craftingState.selectedQuality;
  const qc = CRAFTING_QUALITY_DATA.find((q) => q.id === qualityId);
  if (!qc) {
    craftingState.log.push({ action: 'quality', result: 'No quality currency selected.' });
    renderCraftingSimulator();
    return;
  }
  const item = craftingState.item;
  const valRes = validateCraftingAction(item, { type: 'quality', qualityId });
  if (!valRes.ok) {
    craftingState.log.push({ action: 'quality', result: `Quality upgrade failed: ${valRes.reason}` });
    renderCraftingSimulator();
    return;
  }
  saveCraftingHistory();
  const increment = qc.qualIncrement ?? 5;
  item.quality = Math.min(20, (item.quality ?? 0) + increment);
  craftingState.log.push({
    action: 'quality',
    result: `Applied ${qc.name}: Quality increased by +${increment}% (current: +${item.quality}%)`
  });
  renderCraftingSimulator();
}

function applyCorruptionMechanic() {
  ensureCraftingState();
  const corruptionId = craftingState.selectedCorruption;
  const outcome = CRAFTING_CORRUPTION_DATA.find((c) => c.id === corruptionId);
  if (!outcome) {
    craftingState.log.push({ action: 'corruption', result: 'No corruption type selected.' });
    renderCraftingSimulator();
    return;
  }
  const item = craftingState.item;
  const valRes = validateCraftingAction(item, { type: 'corruption', corruptionId });
  if (!valRes.ok) {
    craftingState.log.push({ action: 'corruption', result: `Corruption failed: ${valRes.reason}` });
    renderCraftingSimulator();
    return;
  }
  saveCraftingHistory();
  
  item.corrupted = true;
  
  if (outcome.effect === "brick_to_rare") {
    item.rarity = 'rare';
    item.prefixes = [];
    item.suffixes = [];
    const desired = 4;
    for (let i = 0; i < desired; i++) {
      addRandomModifier(item);
    }
    craftingState.log.push({
      action: 'corruption',
      result: `Used Vaal Orb: Item became corrupted and bricked to Rare with ${item.prefixes.length + item.suffixes.length} modifiers`
    });
  } else if (outcome.effect === "implicit_change") {
    const corruptionImplicits = [
      { id: "corruption-implicit-1", name: "Corrupted Implicit", text: "+1 to Level of socketed Skill Gems", type: "implicit", tags: ["weapon", "armour"] },
      { id: "corruption-implicit-2", name: "Corrupted Implicit", text: "+5% to maximum Fire Resistance", type: "implicit", tags: ["armour"] },
      { id: "corruption-implicit-3", name: "Corrupted Implicit", text: "4% increased maximum Life", type: "implicit", tags: ["armour", "jewellery"] }
    ];
    const baseTags = new Set(item.base.tags ?? []);
    const validImplicits = corruptionImplicits.filter((mod) =>
      mod.tags.some((tag) => baseTags.has(tag))
    );
    const chosen = validImplicits.length > 0
      ? validImplicits[Math.floor(Math.random() * validImplicits.length)]
      : corruptionImplicits[0];

    const rolledImplicit = {
      ...chosen,
      id: `corruption-implicit-${Date.now()}`,
      rolledValues: []
    };
    item.implicits = item.implicits ?? [];
    item.implicits.push(rolledImplicit);
    craftingState.log.push({
      action: 'corruption',
      result: `Used Vaal Orb: Item became corrupted and rolled implicit "${rolledImplicit.text}"`
    });
  } else {
    craftingState.log.push({
      action: 'corruption',
      result: "Used Vaal Orb: Item became corrupted (No Change)"
    });
  }
  
  renderCraftingSimulator();
}

function applySocketCraftingMechanic() {
  ensureCraftingState();
  const socketCraftId = craftingState.selectedSocketCraft;
  const sOption = CRAFTING_SOCKET_CRAFTING_DATA.find((s) => s.id === socketCraftId);
  if (!sOption) {
    craftingState.log.push({ action: 'socket', result: 'No socket craft option selected.' });
    renderCraftingSimulator();
    return;
  }
  const item = craftingState.item;
  const valRes = validateCraftingAction(item, { type: 'socket', socketCraftId });
  if (!valRes.ok) {
    craftingState.log.push({ action: 'socket', result: `Modify Sockets failed: ${valRes.reason}` });
    renderCraftingSimulator();
    return;
  }
  saveCraftingHistory();
  
  item.properties = item.properties ?? {};
  const currentSockets = String(item.properties["Sockets"] ?? "");
  const numSockets = currentSockets.split(" ").filter(Boolean).length;
  
  const updatedSockets = Array(numSockets + 1).fill("S").join(" ");
  item.properties["Sockets"] = updatedSockets;
  
  craftingState.log.push({
    action: 'socket',
    result: `Modified Sockets: Added socket (Sockets: ${updatedSockets})`
  });
  renderCraftingSimulator();
}

window.updateCraftingBaseFilters = updateCraftingBaseFilters;
window.selectCraftingBase = selectCraftingBase;
window.updateCraftingItemLevel = updateCraftingItemLevel;
window.applyCraftingAction = applyCraftingAction;
window.updateCraftingTarget = updateCraftingTarget;
window.simulateTargetCrafts = simulateTargetCrafts;
window.copyCraftedItemJson = copyCraftedItemJson;
window.exportCraftedItemToBuild = exportCraftedItemToBuild;
window.updateCraftingMethod = updateCraftingMethod;
window.updateCraftingEssenceSelection = updateCraftingEssenceSelection;
window.updateCraftingOmenSelection = updateCraftingOmenSelection;
window.updateCraftingRuneSelection = updateCraftingRuneSelection;
window.updateCraftingSoulCoreSelection = updateCraftingSoulCoreSelection;
window.updateCraftingAbyssSelection = updateCraftingAbyssSelection;
window.updateCraftingDesecrationSelection = updateCraftingDesecrationSelection;
window.updateCraftingQualitySelection = updateCraftingQualitySelection;
window.updateCraftingCorruptionSelection = updateCraftingCorruptionSelection;
window.updateCraftingSocketSelection = updateCraftingSocketSelection;
window.applyCraftingEssence = applyCraftingEssence;
window.applyCraftingRune = applyCraftingRune;
window.applyCraftingSoulCore = applyCraftingSoulCore;
window.applyAbyssMechanic = applyAbyssMechanic;
window.applyDesecrationMechanic = applyDesecrationMechanic;
window.applyQualityMechanic = applyQualityMechanic;
window.applyCorruptionMechanic = applyCorruptionMechanic;
window.applySocketCraftingMechanic = applySocketCraftingMechanic;

// ── JSON editor ────────────────────────────────────────────────────────────
function onJsonEdit() {
  const jsonEl   = $('json');
  const statusEl = $('json-status');
  if (!jsonEl || !statusEl) return;
  try {
    lastBuild          = JSON.parse(jsonEl.value);
    statusEl.textContent = '✓ Valid';
    statusEl.className   = 'json-status ok';
  } catch {
    statusEl.textContent = '✗ Invalid JSON';
    statusEl.className   = 'json-status error';
  }
}

function formatJson() {
  const jsonEl = $('json');
  if (!jsonEl) return;
  try {
    jsonEl.value = JSON.stringify(JSON.parse(jsonEl.value), null, 2);
    onJsonEdit();
  } catch {}
}

function resetJson() {
  const jsonEl   = $('json');
  const statusEl = $('json-status');
  if (!jsonEl) return;
  jsonEl.value = lastImportedBuildRaw;
  try { lastBuild = JSON.parse(lastImportedBuildRaw); } catch {}
  if (statusEl) statusEl.textContent = '';
  rerenderEditablePanels();
}

function applyJsonToPreview() {
  const jsonEl = $('json');
  if (!jsonEl) return;
  try {
    lastBuild = JSON.parse(jsonEl.value);
    rerenderEditablePanels();
    const statusEl = $('json-status');
    if (statusEl) {
      statusEl.textContent = 'Applied';
      statusEl.className = 'json-status ok';
    }
  } catch {
    const statusEl = $('json-status');
    if (statusEl) {
      statusEl.textContent = 'Fix JSON first';
      statusEl.className = 'json-status error';
    }
  }
}

// ── Download / copy ────────────────────────────────────────────────────────
function download() {
  if (!lastBuild) return;
  const blob = new Blob([JSON.stringify(lastBuild, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = lastFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyJson() {
  if (!lastBuild) return;
  await clipboardWrite(JSON.stringify(lastBuild, null, 2), $('copy'));
}

async function copySection(section) {
  if (!lastBuild) return;
  const payload = {};
  if (section === 'skills')   payload.skills   = lastBuild.skills   ?? [];
  if (section === 'passives') payload.passives = lastBuild.passives ?? [];
  if (section === 'items')    payload.items    = lastBuild.items    ?? [];
  await clipboardWrite(JSON.stringify(payload, null, 2));
}

async function clipboardWrite(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = orig), 1200);
    }
  } catch {
    setStatus('Clipboard access blocked.', 'error');
  }
}

// ── Display helpers ────────────────────────────────────────────────────────
function rerenderEditablePanels() {
  if (!lastData || !lastBuild) return;
  if (!$('tab-overview')) return; // not on converter page
  normalizeBuildGemLevels(lastBuild);
  const passiveNames = lastData.passiveNames ?? {};
  const passiveAscendancies = lastData.passiveAscendancies ?? {};
  const ascendancyNames = lastData.ascendancyNames ?? {};
  const splitPassives = splitAscendancyPassives(lastBuild.passives ?? [], passiveAscendancies);
  renderOverviewTab(lastBuild, lastData.report, lastData.source, lastData.preview?.meta, ascendancyNames);
  renderPreviewTab(lastBuild, lastData.report, lastData.source, lastData.preview?.meta, passiveNames, passiveAscendancies, ascendancyNames);
  renderEditableSkills(lastBuild.skills ?? []);
  renderEditablePassives(splitPassives.regular, lastData.report, passiveNames);
  renderEditablePassives(splitPassives.ascendancy, lastData.report, passiveNames, 'tab-ascendancy', { title: 'Ascendancy Points', hideBuildOptions: true });
  renderEditableItems(lastBuild.items ?? []);
  renderCraftingSimulator();
  renderProblemsTab(lastData.report);
  syncJsonEditorFromBuild();
  setupAllocatedTree(lastBuild);
}

function syncJsonEditorFromBuild(clearStatus = false) {
  const jsonEl = $('json');
  const statusEl = $('json-status');
  if (!jsonEl || !lastBuild) return;
  lastBuildRaw = JSON.stringify(lastBuild, null, 2);
  jsonEl.value = lastBuildRaw;
  if (statusEl && clearStatus) statusEl.textContent = '';
}

function formatLevelInterval(interval) {
  const normalized = normalizeLevelIntervalValue(interval);
  return `${normalized[0]}-${normalized[1]}`;
}

function normalizeLevelIntervalValue(interval) {
  if (Array.isArray(interval) && interval.length === 2) {
    const start = Number(interval[0]);
    const end = Number(interval[1]);
    if (Number.isFinite(start) && Number.isFinite(end)) return [start, end];
  }
  return [0, 100];
}

function parseLevelIntervalInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return [0, 100];
  const match = raw.match(/^(\d+)\s*[-,]\s*(\d+)$/);
  if (match) return [Number(match[1]), Number(match[2])];
  const single = Number(raw);
  return Number.isFinite(single) ? [single, 100] : [0, 100];
}

function renderLevelIntervalControls(interval, updateHandlerName, index) {
  const [start, end] = normalizeLevelIntervalValue(interval);
  return `
    <label class="edit-field">
      <span class="edit-label">Start Level</span>
      <select onchange="${updateHandlerName}(${index}, 'start', this.value)">
        ${levelIntervalOptions(start)}
      </select>
    </label>
    <label class="edit-field">
      <span class="edit-label">End Level</span>
      <select onchange="${updateHandlerName}(${index}, 'end', this.value)">
        ${levelIntervalOptions(end)}
      </select>
    </label>`;
}

function levelIntervalOptions(selectedValue) {
  const selected = clampBuildLevel(selectedValue);
  const options = [];
  for (let level = 0; level <= 100; level += 1) {
    options.push(`<option value="${level}"${level === selected ? ' selected' : ''}>${level}</option>`);
  }
  return options.join('');
}

function updateLevelIntervalPart(interval, part, value) {
  let [start, end] = normalizeLevelIntervalValue(interval).map(clampBuildLevel);
  const next = clampBuildLevel(value);
  if (part === 'start') start = next;
  else end = next;
  if (start > end) {
    if (part === 'start') end = start;
    else start = end;
  }
  return [start, end];
}

function clampBuildLevel(value) {
  const level = Number(value);
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(100, Math.floor(level)));
}

function parseGemAdditionalText(value) {
  const raw = String(value ?? '').trim();
  const parts = raw
    ? raw.split('|').map((part) => part.trim()).filter(Boolean)
    : [];
  let level = '';
  let quality = '';
  const notes = [];

  for (const part of parts) {
    const levelMatch = part.match(/^Level\s+(\d+)$/i);
    if (levelMatch) {
      level = levelMatch[1];
      continue;
    }
    const qualityMatch = part.match(/^Quality\s+(\d+)%?$/i);
    if (qualityMatch) {
      quality = qualityMatch[1];
      continue;
    }
    const note = part
      .replace(/\bLevel\s+\d+\b/ig, '')
      .replace(/\bQuality\s+\d+%?/ig, '')
      .replace(/\s*\|\s*/g, ' ')
      .trim();
    if (note) notes.push(note);
  }

  if (!level) {
    const match = raw.match(/\bLevel\s+(\d+)\b/i);
    if (match) level = match[1];
  }
  if (!quality) {
    const match = raw.match(/\bQuality\s+(\d+)%?/i);
    if (match) quality = match[1];
  }

  return { level, quality, notes: notes.join(' | ') };
}

function buildGemAdditionalText(meta) {
  const parts = [];
  const level = String(meta?.level ?? '').trim();
  const quality = String(meta?.quality ?? '').trim();
  const notes = String(meta?.notes ?? '').trim();
  if (level) parts.push(`Level ${level}`);
  if (quality) parts.push(`Quality ${quality}%`);
  if (notes) parts.push(notes);
  return parts.join(' | ');
}

function updateGemAdditionalField(gem, field, value, role = 'skill') {
  const meta = parseGemAdditionalText(gem.additional_text);
  if (field === 'gem_level') meta.level = normalizeGemLevelSelection(gem.id, value, role);
  if (field === 'gem_quality') meta.quality = String(value ?? '').trim();
  if (field === 'gem_notes') meta.notes = String(value ?? '').trim();
  const text = buildGemAdditionalText(meta);
  if (text) gem.additional_text = text;
  else delete gem.additional_text;
}

function normalizeGemLevelSelection(gemId, value, role = 'skill') {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const level = Number(raw);
  if (!Number.isFinite(level) || level <= 0) return '';
  const max = gemMaxLevel(gemId, role);
  return String(Math.min(Math.floor(level), max));
}

function displayGemLevelSelection(gemId, value, role = 'skill') {
  const normalized = normalizeGemLevelSelection(gemId, value, role);
  if (normalized) return normalized;
  return isSupportGemId(gemId) ? '1' : '';
}

function gemLevelOptions(gemId, selectedValue, role = 'skill') {
  const selected = displayGemLevelSelection(gemId, selectedValue, role);
  const max = gemMaxLevel(gemId, role);
  const options = ['<option value=""></option>'];
  for (let level = 1; level <= max; level += 1) {
    const value = String(level);
    options.push(`<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`);
  }
  return options.join('');
}

function gemMaxLevel(gemId, role = 'skill') {
  const id = String(gemId ?? '');
  if (isSupportGemId(id)) return inferSupportGemMaxLevel(id);
  if (isSkillGemId(id)) return 20;
  return role === 'support' ? 5 : 20;
}

function isSkillGemId(id) {
  return /(?:^|\/)SkillGem/i.test(String(id ?? ''));
}

function isSupportGemId(id) {
  return /(?:^|\/)SupportGem/i.test(String(id ?? ''));
}

function inferSupportGemMaxLevel(gemId) {
  const name = gemName(gemId);
  const idPart = String(gemId ?? '').split('/').pop() ?? '';
  const suffixCandidates = [name, idPart];
  for (const candidate of suffixCandidates) {
    const numeric = String(candidate).match(/\b([1-5])\s*$/);
    if (numeric) return Number(numeric[1]);
    const roman = String(candidate).match(/\b(I|II|III|IV|V)\s*$/i);
    if (roman) return ROMAN_SUPPORT_LEVELS[roman[1].toUpperCase()] ?? 5;
  }

  const wordSuffix = idPart.match(/(One|Two|Three|Four|Five)$/);
  if (wordSuffix) return WORD_SUPPORT_LEVELS[wordSuffix[1]] ?? 5;
  return 5;
}

const ROMAN_SUPPORT_LEVELS = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
};

const WORD_SUPPORT_LEVELS = {
  One: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5,
};

function normalizeBuildGemLevels(build) {
  if (!build?.skills) return;
  for (const skill of build.skills) {
    if (!skill || typeof skill !== 'object') continue;
    normalizeGemAdditionalLevel(skill, 'skill');
    for (const support of skill.support_skills ?? []) {
      if (support && typeof support === 'object') normalizeGemAdditionalLevel(support, 'support');
    }
  }
}

function normalizeGemAdditionalLevel(gem, role = 'skill') {
  const meta = parseGemAdditionalText(gem.additional_text);
  const level = displayGemLevelSelection(gem.id, meta.level, role);
  if (level === meta.level) return;
  const text = buildGemAdditionalText({ ...meta, level });
  if (text) gem.additional_text = text;
  else delete gem.additional_text;
}

function normalizeBuildSkill(skill) {
  return {
    id: skill?.id ?? '',
    level_interval: normalizeLevelIntervalValue(skill?.level_interval),
    additional_text: skill?.additional_text ?? '',
    support_skills: (skill?.support_skills ?? []).map((support) => typeof support === 'string'
      ? { id: support, level_interval: [0, 100], additional_text: '' }
      : {
          id: support?.id ?? '',
          level_interval: normalizeLevelIntervalValue(support?.level_interval),
          additional_text: support?.additional_text ?? '',
        }),
  };
}

function updateBuildRootField(field, value) {
  if (!lastBuild) return;
  if (value.trim()) lastBuild[field] = value;
  else delete lastBuild[field];
  rerenderEditablePanels();
}

function updateSkillField(index, field, value) {
  if (!lastBuild?.skills?.[index]) return;
  const skill = normalizeBuildSkill(lastBuild.skills[index]);
  if (field === 'level_interval') skill.level_interval = parseLevelIntervalInput(value);
  else if (field === 'gem_level' || field === 'gem_quality' || field === 'gem_notes') {
    updateGemAdditionalField(skill, field, value, 'skill');
  }
  else if (field === 'additional_text') {
    if (value.trim()) skill.additional_text = value;
    else delete skill.additional_text;
  } else {
    skill[field] = value;
  }
  lastBuild.skills[index] = skill;
  rerenderEditablePanels();
}

function updateSkillSupportField(skillIndex, supportIndex, field, value) {
  if (!lastBuild?.skills?.[skillIndex]) return;
  const skill = normalizeBuildSkill(lastBuild.skills[skillIndex]);
  const support = skill.support_skills[supportIndex];
  if (!support) return;
  if (field === 'level_interval') support.level_interval = parseLevelIntervalInput(value);
  else if (field === 'gem_level' || field === 'gem_quality' || field === 'gem_notes') {
    updateGemAdditionalField(support, field, value, 'support');
  }
  else if (field === 'additional_text') {
    if (value.trim()) support.additional_text = value;
    else delete support.additional_text;
  } else {
    support[field] = value;
  }
  skill.support_skills[supportIndex] = support;
  lastBuild.skills[skillIndex] = skill;
  rerenderEditablePanels();
}

function addSkill() {
  if (!lastBuild) return;
  lastBuild.skills = lastBuild.skills ?? [];
  lastBuild.skills.push({ id: '', level_interval: [0, 100], support_skills: [] });
  rerenderEditablePanels();
}

function removeSkill(index) {
  if (!lastBuild?.skills) return;
  lastBuild.skills.splice(index, 1);
  rerenderEditablePanels();
}

function addSkillSupport(skillIndex) {
  if (!lastBuild?.skills?.[skillIndex]) return;
  const skill = normalizeBuildSkill(lastBuild.skills[skillIndex]);
  skill.support_skills.push({ id: '', level_interval: [0, 100], additional_text: '' });
  lastBuild.skills[skillIndex] = skill;
  rerenderEditablePanels();
}

function removeSkillSupport(skillIndex, supportIndex) {
  if (!lastBuild?.skills?.[skillIndex]) return;
  const skill = normalizeBuildSkill(lastBuild.skills[skillIndex]);
  skill.support_skills.splice(supportIndex, 1);
  lastBuild.skills[skillIndex] = skill;
  rerenderEditablePanels();
}

function updatePassiveField(index, field, value) {
  if (!lastBuild?.passives?.[index]) return;
  const passive = typeof lastBuild.passives[index] === 'string'
    ? { id: lastBuild.passives[index], level_interval: [0, 100] }
    : { ...lastBuild.passives[index] };
  if (field === 'level_interval') passive.level_interval = parseLevelIntervalInput(value);
  else if (field === 'weapon_set') {
    const num = Number(value);
    if (num === 1 || num === 2) passive.weapon_set = num;
    else delete passive.weapon_set;
  } else if (field === 'additional_text') {
    if (value.trim()) passive.additional_text = value;
    else delete passive.additional_text;
  } else {
    passive[field] = value;
  }
  lastBuild.passives[index] = passive;
  rerenderEditablePanels();
}

function updatePassiveLevelIntervalPart(index, part, value) {
  if (!lastBuild?.passives?.[index]) return;
  const passive = typeof lastBuild.passives[index] === 'string'
    ? { id: lastBuild.passives[index], level_interval: [0, 100] }
    : { ...lastBuild.passives[index] };
  passive.level_interval = updateLevelIntervalPart(passive.level_interval, part, value);
  lastBuild.passives[index] = passive;
  rerenderEditablePanels();
}

function addPassive() {
  if (!lastBuild) return;
  lastBuild.passives = lastBuild.passives ?? [];
  lastBuild.passives.push({ id: '', level_interval: [0, 100] });
  rerenderEditablePanels();
}

function removePassive(index) {
  if (!lastBuild?.passives) return;
  lastBuild.passives.splice(index, 1);
  rerenderEditablePanels();
}

function updateItemField(index, field, value) {
  if (!lastBuild?.items?.[index]) return;
  const item = { ...lastBuild.items[index] };
  if (field === 'level_interval') item.level_interval = parseLevelIntervalInput(value);
  else if (field === 'additional_text' || field === 'unique_name') {
    if (value.trim()) item[field] = value;
    else delete item[field];
  } else {
    item[field] = value;
  }
  lastBuild.items[index] = item;
  rerenderEditablePanels();
}

function updateItemLevelIntervalPart(index, part, value) {
  if (!lastBuild?.items?.[index]) return;
  const item = { ...lastBuild.items[index] };
  item.level_interval = updateLevelIntervalPart(item.level_interval, part, value);
  lastBuild.items[index] = item;
  rerenderEditablePanels();
}

function addItem() {
  if (!lastBuild) return;
  lastBuild.items = lastBuild.items ?? [];
  lastBuild.items.push({ inventory_id: '', slot_x: 0, slot_y: 0, level_interval: [0, 100] });
  rerenderEditablePanels();
}

function removeItem(index) {
  if (!lastBuild?.items) return;
  lastBuild.items.splice(index, 1);
  rerenderEditablePanels();
}

window.updateBuildRootField = updateBuildRootField;
window.updateSkillField = updateSkillField;
window.updateSkillSupportField = updateSkillSupportField;
window.addSkill = addSkill;
window.removeSkill = removeSkill;
window.addSkillSupport = addSkillSupport;
window.removeSkillSupport = removeSkillSupport;
window.updatePassiveField = updatePassiveField;
window.updatePassiveLevelIntervalPart = updatePassiveLevelIntervalPart;
window.addPassive = addPassive;
window.removePassive = removePassive;
window.updateItemField = updateItemField;
window.updateItemLevelIntervalPart = updateItemLevelIntervalPart;
window.addItem = addItem;
window.removeItem = removeItem;

function gemName(id) {
  const part = (id ?? '').split('/').pop() ?? id;
  return part
    .replace(/^SkillGem/, '')
    .replace(/^SupportGem/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')        // camelCase → spaced
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')  // acronym edge cases
    .trim() || id;
}

function displayGemName(gem) {
  if (typeof gem === 'string') return gemName(gem);
  const preferred = [
    gem?.displayName,
    readableGemName(gem?.nameSpec),
    readableGemName(gem?.skillId),
  ].find(Boolean);
  return preferred || gemName(gem?.gemId || gem?.skillId || '');
}

function readableGemName(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/[ /'.-]/.test(raw)) return raw;
  if (/^(SkillGem|SupportGem)/.test(raw)) return '';
  if (/^[a-z0-9]+$/.test(raw)) return '';
  return gemName(raw);
}

function renderGemLevelTag(gem) {
  const level = Number(gem?.level);
  return Number.isFinite(level) && level > 1
    ? `<span class="tag">Lvl ${level}</span>`
    : '';
}

function renderIntervalTag(interval) {
  if (!interval || isNaN(interval[0])) return '';
  if (interval[0] <= 1) return '';
  return `<span class="tag amber">Lvl ${interval[0]}+</span>`;
}

function prettySlot(id) {
  if (!id) return '—';
  return SLOT_DISPLAY[id] || String(id).replace(/([A-Z])/g, ' $1').trim();
}

function normalizePassive(passive) {
  if (typeof passive === 'string') {
    return { id: passive, levelInterval: [0, 100], weaponSet: null, additional_text: '' };
  }
  return {
    id:            passive.id,
    levelInterval: passive.level_interval ?? [0, 100],
    weaponSet:     passive.weapon_set     ?? null,
    additional_text: passive.additional_text ?? '',
  };
}

function isWeaponSetPassive(passive) {
  return getWeaponSet(passive) != null;
}

function getWeaponSet(passive) {
  return typeof passive === 'object' && passive ? passive.weapon_set ?? null : null;
}

function formatPassiveId(id) {
  return String(id ?? '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSelValue(v) {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function setStatus(msg, cls) {
  const el = $('status');
  el.textContent = msg;
  el.className   = `status ${cls}`;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return esc(str).replace(/'/g, '&#39;');
}

// ── Interactive Skill Tree Rendering Engine ───────────────────────────────
let _treeData        = null;   // loaded tree-data.json
let _treeGraph       = null;   // parsed passive skill tree graph
let _treeCanvas      = null;
let _treeCtx         = null;
let _treeZoom        = 0.015;
let _treePanX        = 0;
let _treePanY        = 0;
let _treeDragging    = false;
let _treeDragStart   = null;
let _treeAllocated   = new Set(); // canonical set of allocated node hash strings
let _treeSidMap      = {};        // GGG string ID → hash string
let _treeAllocatedPassiveNodeIds = new Set(); // canonical imported .build passive IDs
let _treeNodeIdsById = new Map(); // GGG string ID -> tree node metadata
let _treeValidation  = {
  importedCount: 0,
  matchedCount: 0,
  missingIds: [],
  duplicateIds: [],
  allocatedEdgeCount: 0,
};
let _treeHovered     = null;
let _treeFrame       = null;
let _treeStartHash   = null;      // class start hash
let _activeBuildForTree = null;
let _showTreeDebug   = false;

// Ascendancy selection states
let _treeViewMode         = 'main';    // 'main' | 'ascendancy-overview' | 'ascendancy-detail'
let _selectedAscendancyId = null;    // active ascendancy class name
let _treeHoveredCard      = null;    // hovered card object on selection screen

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

const CLASS_TO_ASCENDANCIES = {
  Witch: ['Infernalist', 'Blood Mage', 'Lich'],
  Ranger: ['Deadeye', 'Pathfinder'],
  Sorceress: ['Stormweaver', 'Chronomancer', 'Disciple of Varashta'],
  Warrior: ['Titan', 'Warbringer', 'Smith of Kitava'],
  Mercenary: ['Tactician', 'Witchhunter', 'Gemling Legionnaire'],
  Monk: ['Invoker', 'Acolyte of Chayula'],
  Druid: ['Oracle', 'Shaman'],
  Huntress: ['Amazon', 'Ritualist']
};

const ASCENDANCY_TO_CLASS = {
  Infernalist: 'Witch',
  'Blood Mage': 'Witch',
  Lich: 'Witch',
  Deadeye: 'Ranger',
  Pathfinder: 'Ranger',
  Stormweaver: 'Sorceress',
  Chronomancer: 'Sorceress',
  'Disciple of Varashta': 'Sorceress',
  Titan: 'Warrior',
  Warbringer: 'Warrior',
  'Smith of Kitava': 'Warrior',
  Tactician: 'Mercenary',
  Witchhunter: 'Mercenary',
  'Gemling Legionnaire': 'Mercenary',
  Invoker: 'Monk',
  'Acolyte of Chayula': 'Monk',
  Oracle: 'Druid',
  Shaman: 'Druid',
  Amazon: 'Huntress',
  Ritualist: 'Huntress'
};

// Resolve any GGG ascendancy ID or display name to the canonical display name used in tree-data.json
// Handles formats like "Pathfinder", "AscendancyPathfinder1", "ranger_pathfinder", etc.
function resolveAscendancyDisplayName(candidate) {
  if (!candidate) return null;

  // Collect all known ascendancy display names from the flat map
  const allKnown = Object.values(CLASS_TO_ASCENDANCIES).flat();

  // 1. Exact match (case-insensitive)
  const exact = allKnown.find(a => a.toLowerCase() === candidate.toLowerCase());
  if (exact) return exact;

  // 2. GGG ClassName+Number format: "Witch2" → CLASS_TO_ASCENDANCIES['Witch'][1]
  //    Also handles "Ranger1", "Warrior3", "Sorceress2", etc.
  const classNumMatch = candidate.match(/^([A-Za-z]+)(\d+)$/);
  if (classNumMatch) {
    const className = classNumMatch[1];
    const idx = parseInt(classNumMatch[2], 10) - 1; // 1-indexed → 0-indexed
    // Try exact class name first
    const directOptions = CLASS_TO_ASCENDANCIES[className];
    if (directOptions && directOptions[idx]) return directOptions[idx];
    // Try case-insensitive class name match
    const classKey = Object.keys(CLASS_TO_ASCENDANCIES).find(k => k.toLowerCase() === className.toLowerCase());
    if (classKey) {
      const opts = CLASS_TO_ASCENDANCIES[classKey];
      if (opts && opts[idx]) return opts[idx];
    }
  }

  // 3. Tree-data scan: match node.ascendancy case-insensitively
  if (_treeGraph) {
    const seen = new Set();
    for (const node of _treeGraph.nodes.values()) {
      if (!node.ascendancy || seen.has(node.ascendancy)) continue;
      seen.add(node.ascendancy);
      if (node.ascendancy.toLowerCase() === candidate.toLowerCase()) return node.ascendancy;
    }
  }

  // 4. Partial / contains match against known names
  const candidateLower = candidate.toLowerCase().replace(/[^a-z]/g, '');
  const partial = allKnown.find(a => {
    const aLower = a.toLowerCase().replace(/[^a-z]/g, '');
    return candidateLower.includes(aLower) || aLower.includes(candidateLower);
  });
  if (partial) return partial;

  // 5. Tree-data contains-match
  if (_treeGraph) {
    const seen = new Set();
    for (const node of _treeGraph.nodes.values()) {
      if (!node.ascendancy || seen.has(node.ascendancy)) continue;
      seen.add(node.ascendancy);
      const aLower = node.ascendancy.toLowerCase().replace(/[^a-z]/g, '');
      if (candidateLower.includes(aLower) || aLower.includes(candidateLower)) return node.ascendancy;
    }
  }

  return null;
}

// Clean asset manager that tries to pre-load PoE2 background & node assets
const _treeAssets = {
  loaded: false,
  images: {},
  
  async load() {
    if (this.loaded) return;
    
    const assetsToLoad = {
      bg_tile: 'https://web.poecdn.com/image/passive-skill-tree/Background2.png'
    };
    
    const promises = [];
    const loadImage = (name, url) => new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.images[name] = img;
        resolve();
      };
      img.onerror = () => {
        resolve(); // Fall back silently if image fails to load
      };
      img.src = url;
    });

    for (const [name, url] of Object.entries(assetsToLoad)) {
      promises.push(loadImage(name, url));
    }
    
    await Promise.all(promises);
    this.loaded = true;
    console.info("[Tree] Asset preloading completed. Available sprites:", Object.keys(this.images));
  }
};

function setupAllocatedTree(build) {
  _activeBuildForTree = build;
  if (!_activeBuildForTree) {
    _treeAllocated = new Set();
    _treeAllocatedPassiveNodeIds = new Set();
    _treeValidation = { importedCount: 0, matchedCount: 0, missingIds: [], duplicateIds: [], allocatedEdgeCount: 0 };
    _selectedAscendancyId = null;
    updateTreeDebugPanel();
    return;
  }

  if (_treeData) {
    // 1. Populate the canonical allocatedPassiveNodeIds set directly from the imported build.
    // Imported builds must render exact passive IDs only; no generated route/path nodes.
    const allocation = resolveTreeAllocationForViewer(build);
    _treeAllocatedPassiveNodeIds = allocation.allocatedPassiveNodeIds;
    _treeAllocated = allocation.allocatedHashes;
    _treeStartHash = allocation.startHash;
    _treeValidation = {
      importedCount: allocation.importedCount,
      matchedCount: allocation.allocatedHashes.size,
      missingIds: allocation.missingIds,
      duplicateIds: allocation.duplicateIds,
      allocatedEdgeCount: 0,
    };

    console.info("[Converter] imported passive IDs:", allocation.importedCount);
    console.info("[Tree] allocated passive IDs:", _treeAllocatedPassiveNodeIds.size);
    for (const id of allocation.missingIds) {
      console.warn("[Tree] allocated passive ID not found:", id);
    }

    // 2. Synchronize selected Ascendancy — resolve any GGG ID to tree-data display name
    let resolvedAsc = build.ascendancy ? resolveAscendancyDisplayName(build.ascendancy) : null;

    // Fallback: detect from allocated nodes
    if (!resolvedAsc) {
      for (const hash of _treeAllocated) {
        const node = _treeGraph?.nodes.get(hash);
        if (node && node.ascendancy) {
          resolvedAsc = node.ascendancy;
          break;
        }
      }
    }
    _selectedAscendancyId = resolvedAsc;
    console.info('[Tree] resolved ascendancy:', build.ascendancy, '->', _selectedAscendancyId);

    // Write the resolved display name back so validation & UI use the correct name
    if (resolvedAsc && lastBuild && lastBuild === build) {
      lastBuild.ascendancy = resolvedAsc;
    }

    // 3. Synchronize active state to graph nodes
    applyAllocatedBuild();

    // 4. Deep Passive Connectivity & Context Validation (pushes warnings directly to Problems panel)
    const r = lastData?.report || { converted: [], guessed: [], unsupported: [], warnings: [] };
    r.unsupported = r.unsupported.filter(msg => !msg.startsWith('[Tree]'));
    r.warnings = r.warnings.filter(msg => !msg.startsWith('[Tree]'));
    validatePassiveTree(build, r);
    renderProblemsTab(r);
    updateTreeDebugPanel();

    // 5. Update Problems tab badge count
    const issues = r.guessed.length + r.unsupported.length;
    const badge  = $('problems-badge');
    if (badge) {
      badge.textContent = issues;
      badge.classList.toggle('hidden', issues === 0);
    }
  }
}

function applyBuildToTree() {
  if (!_activeBuildForTree || !_treeData) return;
  
  _treeViewMode = 'main';
  updateTreeControlsOverlay();

  setupAllocatedTree(_activeBuildForTree);
  fitTreeView();
  scheduleTreeRender();
}

async function onTreeTabActive() {
  const loading = $('tree-loading');
  if (loading && !_treeData) {
    loading.style.display = 'flex';
    loading.style.opacity = '1';
    loading.innerHTML = '<span>Loading Skill Tree...</span>';
  }

  try {
    await loadTreeData();
    await _treeAssets.load();
    initTreeViewer();
    applyBuildToTree();
    
    if (loading) {
      loading.style.transition = 'opacity 0.25s ease';
      loading.style.opacity = '0';
      setTimeout(() => {
        loading.style.display = 'none';
      }, 250);
    }
  } catch (err) {
    console.error("[Tree] Error loading tree:", err);
    if (loading) {
      loading.style.display = 'flex';
      loading.style.opacity = '1';
      loading.innerHTML = `<div style="text-align:center; padding:20px;">
        <span style="color:var(--red); font-weight:bold; display:block; margin-bottom:8px;">Failed to Load Skill Tree</span>
        <span style="color:var(--muted-2); font-size:12px; display:block; max-width:400px;">${esc(err.message)}</span>
      </div>`;
    }
  }
}

async function loadTreeData() {
  if (_treeData) return _treeData;
  const resp = await fetch('/tree-data.json');
  if (!resp.ok) {
    throw new Error(`Failed to fetch tree-data.json (HTTP ${resp.status} ${resp.statusText})`);
  }
  const rawData = await resp.json();
  parseSkillTreeData(rawData);
  return _treeData;
}

function parseSkillTreeData(rawData) {
  _treeData = rawData;
  
  _treeSidMap = {};
  _treeNodeIdsById = new Map();
  for (const [hash, node] of Object.entries(_treeData.nodes)) {
    if (node.sid) {
      const sid = String(node.sid);
      _treeSidMap[sid] = String(hash);
      _treeNodeIdsById.set(sid, { hash: String(hash), node });
    }

    // Also build name-based aliases for ascendancy nodes.
    // PoB exports use "AscendancyWitch2Notable_GraspingWounds" style IDs,
    // but tree-data.json uses "AscendancyWitch2Notable7" (numeric suffix).
    // We index both so builds from any source resolve correctly.
    if (node.a && node.sid && node.n) {
      // Strip trailing numbers/underscores from the SID to get the prefix
      // e.g. "AscendancyWitch2Notable7" → "AscendancyWitch2Notable"
      const sidPrefix = String(node.sid).replace(/[\d_]+$/, '');
      // Build a name slug: "Grasping Wounds" → "GraspingWounds"
      const nameSlug = String(node.n).replace(/[^a-zA-Z0-9]/g, '');
      const nameBasedId = `${sidPrefix}_${nameSlug}`;
      if (!_treeSidMap[nameBasedId]) {
        _treeSidMap[nameBasedId] = String(hash);
      }
      // Also try without underscore separator: "AscendancyWitch2NotableGraspingWounds"
      const nameBasedIdNoSep = `${sidPrefix}${nameSlug}`;
      if (!_treeSidMap[nameBasedIdNoSep]) {
        _treeSidMap[nameBasedIdNoSep] = String(hash);
      }
    }
  }
  
  _treeGraph = buildPassiveGraph(_treeData);
}

// Resolve a build passive ID (numeric hash, SID, or name-based alias) to a hash string.
// Falls back to a fuzzy ascendancy-name search when all other lookups fail.
function resolveTreePassiveHash(id) {
  const sid = String(id ?? '').trim();
  if (!sid) return null;

  // 1. Direct numeric hash key
  if (_treeData?.nodes?.[sid]) return sid;

  // 2. Exact SID or name-based alias
  if (_treeSidMap[sid]) return _treeSidMap[sid];

  // 3. Case-insensitive SID scan
  const lower = sid.toLowerCase();
  for (const [key, hash] of Object.entries(_treeSidMap)) {
    if (key.toLowerCase() === lower) return hash;
  }

  // 4. Fuzzy: strip non-alphanumeric and compare
  const stripped = sid.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, hash] of Object.entries(_treeSidMap)) {
    if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === stripped) return hash;
  }

  return null;
}



function extractBuildPassiveIds(build) {
  return (build?.passives || [])
    .map(p => normalizeTreePassiveId(typeof p === 'string' ? p : p?.id))
    .filter(Boolean);
}

function validateAllocatedNodesAgainstTree(allocatedPassiveNodeIds, treeNodesById) {
  const missing = [];
  for (const id of allocatedPassiveNodeIds) {
    // A node is truly missing only if NO lookup strategy finds it
    const resolved = resolveTreePassiveHash(id);
    if (!resolved && !treeNodesById.has(id) && !_treeData?.nodes?.[id]) {
      missing.push(id);
    }
  }
  return missing;
}


function resolveTreeAllocationForViewer(build = {}) {
  const passiveIds = extractBuildPassiveIds(build);
  const allocatedPassiveNodeIds = new Set();
  const allocatedHashes = new Set();
  const duplicateIds = [];
  const seenIds = new Set();

  for (const id of passiveIds) {
    if (seenIds.has(id)) duplicateIds.push(id);
    seenIds.add(id);
    allocatedPassiveNodeIds.add(id);

    const hash = resolveTreePassiveHash(id);
    if (hash && _treeGraph?.nodes.has(hash)) {
      allocatedHashes.add(hash);
    }
  }

  const missingIds = validateAllocatedNodesAgainstTree(allocatedPassiveNodeIds, _treeNodeIdsById);

  return {
    importedCount: passiveIds.length,
    allocatedPassiveNodeIds,
    allocatedHashes,
    duplicateIds,
    missingIds,
    startHash: findTreeClassStartHash(build.class) || inferTreeStartHash([...allocatedHashes].map((hash, index) => ({ hash, index }))),
  };
}

function buildPassiveGraph(treeData) {
  const graph = {
    nodes: new Map(),
    edges: []
  };

  if (!treeData || !treeData.nodes) return graph;

  const rawNodes = treeData.nodes;
  let edgeCount = 0;
  let missingCoordsCount = 0;
  let missingNodeRefs = 0;

  // 1. Build Node Map
  for (const [id, rawNode] of Object.entries(rawNodes)) {
    if (rawNode.x === undefined || rawNode.y === undefined) {
      console.warn(`[Tree] allocated node missing coordinates: nodeId=${id}`);
      missingCoordsCount++;
    }

    const node = {
      id: String(id),
      x: Number(rawNode.x || 0),
      y: Number(rawNode.y || 0),
      name: rawNode.n || '',
      type: rawNode.t || 'normal', // normal, notable, keystone, jewel, ascendancy, start
      connections: [],
      group: rawNode.g,
      gx: rawNode.gx,
      gy: rawNode.gy,
      o: rawNode.o,
      R: rawNode.R,
      ascendancy: rawNode.a || null,
      stats: rawNode.sd || [],
      allocated: false,
      sid: rawNode.sid || ''
    };

    graph.nodes.set(id, node);
  }

  // 2. Build Connections and Unique Edges
  const seenEdges = new Set();

  for (const [id, rawNode] of Object.entries(rawNodes)) {
    const node = graph.nodes.get(id);
    if (!node) continue;

    const conns = rawNode.co || (rawNode.c || []).map(cid => ({ id: String(cid), orbit: 0 }));

    for (const conn of conns) {
      const targetId = String(conn.id);
      const targetNode = graph.nodes.get(targetId);

      if (!targetNode) {
        console.warn(`[Tree] missing node for connection: ${id} -> ${targetId}`);
        missingNodeRefs++;
        continue;
      }

      if (!node.connections.includes(targetId)) {
        node.connections.push(targetId);
      }
      if (!targetNode.connections.includes(id)) {
        targetNode.connections.push(id);
      }

      const numSrc = Number(id);
      const numTgt = Number(targetId);
      if (numSrc === numTgt) continue;

      // Unique edges using numerical sorting (prevents string lexicographical <= bugs)
      const edgeKey = numSrc < numTgt ? `${numSrc}-${numTgt}` : `${numTgt}-${numSrc}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        graph.edges.push({
          sourceId: numSrc < numTgt ? id : targetId,
          targetId: numSrc < numTgt ? targetId : id,
          orbit: Number(conn.orbit || 0),
          isAllocated: false
        });
        edgeCount++;
      }
    }
  }

  console.info("[Tree] loaded nodes:", graph.nodes.size);
  console.info("[Tree] loaded edges:", graph.edges.length);

  return graph;
}

function applyAllocatedBuild() {
  if (!_treeGraph) return;

  let allocatedCount = 0;
  let allocatedEdgeCount = 0;

  for (const node of _treeGraph.nodes.values()) {
    node.allocated = _treeAllocated.has(node.id);
    if (node.allocated) allocatedCount++;
  }

  for (const edge of _treeGraph.edges) {
    const sNode = _treeGraph.nodes.get(edge.sourceId);
    const tNode = _treeGraph.nodes.get(edge.targetId);
    edge.isAllocated = !!(sNode?.allocated && tNode?.allocated);
    if (edge.isAllocated) allocatedEdgeCount++;
  }

  console.info("[Tree] allocated nodes:", allocatedCount);
  console.info("[Tree] allocated edges:", allocatedEdgeCount);
  _treeValidation.allocatedEdgeCount = allocatedEdgeCount;

  for (const hash of _treeAllocated) {
    if (!_treeGraph.nodes.has(hash)) {
      console.warn(`[Tree] allocated node missing from tree data: ${hash}`);
    }
  }
  updateTreeDebugPanel();
}

function serializeAllocatedTreeToBuild() {
  if (!lastBuild || !_treeGraph) return;

  const passives = [];
  const activeSids = new Set();

  for (const hash of _treeAllocated) {
    const node = _treeGraph.nodes.get(hash);
    if (!node) continue;
    if (isTreeAscendancyRootNode(node)) continue;

    const sid = node.sid || _treeData.nodes[hash]?.sid || hash;
    if (activeSids.has(sid)) continue;
    activeSids.add(sid);

    const existing = (lastBuild.passives || []).find(p => (typeof p === 'string' ? p : p?.id) === sid);
    if (existing && typeof existing === 'object') {
      passives.push({ ...existing, id: sid });
    } else {
      passives.push({ id: sid, level_interval: [0, 100] });
    }
  }

  lastBuild.passives = passives;
}

function validatePassiveTree(build, report) {
  if (!report || !build || !_treeGraph) return;

  const passiveIds = extractBuildPassiveIds(build);
  
  // 1. Check duplicate allocated nodes
  const seen = new Set();
  const duplicates = [];
  for (const id of passiveIds) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  if (duplicates.length) {
    report.warnings.push(`[Tree] Duplicate allocated passive node ID(s) detected: ${duplicates.join(', ')}`);
  }

  // 2. Check nodes not found in tree data
  const missingInTreeData = validateAllocatedNodesAgainstTree(seen, _treeNodeIdsById);
  const allocatedHashes = [];
  for (const id of seen) {
    const hash = resolveTreePassiveHash(id);
    if (hash && _treeGraph.nodes.has(hash)) {
      allocatedHashes.push(hash);
    }
  }
  if (missingInTreeData.length) {
    report.unsupported.push(`[Tree] Allocated passive node(s) missing from tree-data.json: ${missingInTreeData.join(', ')}`);
  }
  if (passiveIds.length !== allocatedHashes.length) {
    report.warnings.push(`[Tree] Imported passive count (${passiveIds.length}) does not match rendered allocated count (${allocatedHashes.length}).`);
  }
  if (allocatedHashes.length > 4 && _treeValidation.allocatedEdgeCount === 0) {
    report.warnings.push('[Tree] Allocated edge count is suspiciously low; selected IDs may be incompatible with this tree version.');
  }

  // 3. Mismatched start node
  const startHash = findTreeClassStartHash(build.class);
  if (startHash) {
    const startNode = _treeGraph.nodes.get(startHash);
    if (startNode && build.class && startNode.name !== TREE_CLASS_START[build.class] && startNode.name !== String(build.class).toUpperCase()) {
      report.warnings.push(`[Tree] Class start node mismatch: expected start for "${build.class}", got start name "${startNode.name}"`);
    }
  }

  // 4. Connectivity check (allocated nodes disconnected from starting class)
  if (startHash && allocatedHashes.length > 0) {
    const connectedAllocated = new Set();
    const queue = [startHash];
    const visited = new Set([startHash]);

    while (queue.length) {
      const hash = queue.shift();
      const node = _treeGraph.nodes.get(hash);
      if (node && node.allocated) {
        connectedAllocated.add(hash);
      }

      for (const neighborId of node?.connections || []) {
        const neighbor = _treeGraph.nodes.get(neighborId);
        if (!neighbor) continue;
        
        if (neighbor.allocated || neighborId === startHash) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        }
      }
    }

    const disconnected = [];
    for (const hash of allocatedHashes) {
      const node = _treeGraph.nodes.get(hash);
      if (node && !node.ascendancy && hash !== startHash && !connectedAllocated.has(hash)) {
        disconnected.push(node.name || hash);
      }
    }

    if (disconnected.length) {
      report.warnings.push(`[Tree] Allocated passive node(s) disconnected from starting class start node: ${disconnected.slice(0, 5).join(', ')}${disconnected.length > 5 ? '... and ' + (disconnected.length - 5) + ' more' : ''}`);
    }
  }

  // 5. Ascendancy Validation — use the already-resolved _selectedAscendancyId, not the raw build field
  const selectedAsc = _selectedAscendancyId || resolveAscendancyDisplayName(build.ascendancy) || null;
  const allocatedAscs = new Set();

  for (const hash of allocatedHashes) {
    const node = _treeGraph.nodes.get(hash);
    if (node && node.ascendancy) {
      allocatedAscs.add(node.ascendancy);
    }
  }

  const allKnownAscs = Object.values(CLASS_TO_ASCENDANCIES).flat();

  if (selectedAsc && !allKnownAscs.some(a => a.toLowerCase() === selectedAsc.toLowerCase())) {
    report.unsupported.push(`[Tree] Ascendancy "${selectedAsc}" is not a known PoE2 ascendancy.`);
  }

  if (allocatedAscs.size > 1) {
    report.warnings.push(`[Tree] Multiple ascendancy classes have allocated nodes: ${Array.from(allocatedAscs).join(', ')}`);
  }

  if (!selectedAsc && allocatedAscs.size > 0) {
    report.warnings.push(`[Tree] No ascendancy class selected, but nodes are allocated in: ${Array.from(allocatedAscs).join(', ')}`);
  }

  if (selectedAsc && allocatedAscs.size > 0) {
    for (const asc of allocatedAscs) {
      if (asc.toLowerCase() !== selectedAsc.toLowerCase()) {
        report.warnings.push(`[Tree] Selected ascendancy is "${selectedAsc}", but nodes are allocated in "${asc}" — check build source.`);
      }
    }
  }
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

function isMainTreePreviewNode(hash) {
  const node = _treeData?.nodes?.[hash];
  return !!node && !node.a && node.t !== 'jewel' && node.t !== 'start';
}

function initTreeViewer() {
  const canvas = $('tree-canvas');
  if (!canvas) return;

  const fresh = canvas.cloneNode(false);
  canvas.parentElement.replaceChild(fresh, canvas);

  const wrap = fresh.parentElement;
  fresh.width  = (wrap.clientWidth  || 900) * devicePixelRatio;
  fresh.height = (wrap.clientHeight || 520) * devicePixelRatio;

  _treeCanvas = fresh;
  _treeCtx    = fresh.getContext('2d');

  fresh.addEventListener('wheel',      onTreeWheel,     { passive: false });
  fresh.addEventListener('mousedown',  onTreeMouseDown);
  fresh.addEventListener('mousemove',  onTreeMouseMove);
  fresh.addEventListener('mouseup',    onTreeMouseUp);
  fresh.addEventListener('mouseleave', () => { _treeDragging = false; _treeHovered = null; _treeHoveredCard = null; scheduleTreeRender(); });
  fresh.addEventListener('dblclick',   () => { fitTreeView(); scheduleTreeRender(); });

  updateTreeControlsOverlay();
  fitTreeView();
  scheduleTreeRender();
}

function centerViewOnBounds(bounds, padding = 0) {
  if (!bounds || !_treeCanvas) return;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  
  _treePanX = (bounds.minX + bounds.maxX) / 2;
  _treePanY = (bounds.minY + bounds.maxY) / 2;
  
  const pad = padding || (width * 0.08);
  
  _treeZoom = Math.min(
    _treeCanvas.width / (width + pad * 2),
    _treeCanvas.height / (height + pad * 2)
  );
  _treeZoom = Math.max(0.005, Math.min(1.5, _treeZoom));
}

function getAscendancyBounds(ascId) {
  if (!ascId || !_treeGraph) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let found = false;
  
  for (const node of _treeGraph.nodes.values()) {
    if (node.ascendancy && node.ascendancy.toLowerCase() === ascId.toLowerCase()) {
      found = true;
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    }
  }
  return found ? { minX, maxX, minY, maxY } : null;
}

function fitTreeView() {
  if (!_treeData || !_treeCanvas) return;

  if (_treeViewMode === 'main') {
    const start = _treeStartHash ? _treeData.nodes[_treeStartHash] : null;
    const b = _treeData.mainBounds || _treeData.bounds;
    if (start) {
      const spread = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.58;
      _treePanX = start.x;
      _treePanY = start.y;
      _treeZoom = Math.min(
        _treeCanvas.width / (spread * 2),
        _treeCanvas.height / (spread * 2)
      ) * 0.92;
    } else {
      centerViewOnBounds(b);
    }
  } else if (_treeViewMode === 'ascendancy-detail') {
    const bounds = getAscendancyBounds(_selectedAscendancyId);
    if (bounds) {
      centerViewOnBounds(bounds, (bounds.maxX - bounds.minX) * 0.15);
    } else {
      // Fallback: find ALL ascendancy nodes in this build's class and fit to them
      const classAscs = CLASS_TO_ASCENDANCIES[_activeBuildForTree?.class] || [];
      let fallbackBounds = null;
      for (const asc of classAscs) {
        const b = getAscendancyBounds(asc);
        if (!b) continue;
        if (!fallbackBounds) {
          fallbackBounds = { ...b };
        } else {
          fallbackBounds.minX = Math.min(fallbackBounds.minX, b.minX);
          fallbackBounds.maxX = Math.max(fallbackBounds.maxX, b.maxX);
          fallbackBounds.minY = Math.min(fallbackBounds.minY, b.minY);
          fallbackBounds.maxY = Math.max(fallbackBounds.maxY, b.maxY);
        }
      }
      if (fallbackBounds) {
        centerViewOnBounds(fallbackBounds, (fallbackBounds.maxX - fallbackBounds.minX) * 0.05);
      } else {
        // Last resort: use main tree bounds at a sane zoom
        const b = _treeData.mainBounds || _treeData.bounds;
        centerViewOnBounds(b);
      }
    }
  } else {
    // ascendancy-overview
    _treePanX = 0;
    _treePanY = 0;
    _treeZoom = 1;
  }
}

function onTreeWheel(e) {
  if (_treeViewMode === 'ascendancy-overview') return;
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
  if (_treeViewMode === 'ascendancy-overview') return; // no panning in overview
  _treeDragging  = true;
  _treeDragStart = { x: e.clientX, y: e.clientY, px: _treePanX, py: _treePanY };
  _treeCanvas.style.cursor = 'grabbing';
}

function onTreeMouseUp(e) {
  if (_treeViewMode === 'ascendancy-overview') {
    const rect = _treeCanvas.getBoundingClientRect();
    const dpr  = devicePixelRatio;
    const mx   = (e.clientX - rect.left)  * dpr;
    const my   = (e.clientY - rect.top)   * dpr;
    
    if (_treeHoveredCard) {
      const card = _treeHoveredCard;
      // Clear allocated ascendancy nodes if we change class
      if (!_selectedAscendancyId || _selectedAscendancyId.toLowerCase() !== card.id.toLowerCase()) {
        for (const hash of [..._treeAllocated]) {
          const node = _treeGraph.nodes.get(hash);
          if (node && node.ascendancy) {
            _treeAllocated.delete(hash);
          }
        }
      }
      
      _selectedAscendancyId = card.id;
      lastBuild.ascendancy = card.id;
      _treeViewMode = 'ascendancy-detail';
      
      updateTreeControlsOverlay();
      fitTreeView();
      serializeAllocatedTreeToBuild();
      rerenderEditablePanels();
      scheduleTreeRender();
    }
    return;
  }

  if (_treeDragging && _treeDragStart) {
    const dist = Math.hypot(e.clientX - _treeDragStart.x, e.clientY - _treeDragStart.y);
    _treeDragging = false;
    _treeCanvas.style.cursor = _treeHovered ? 'pointer' : 'grab';
    if (dist < 5) {
      onTreeCanvasClick(e);
    }
  } else {
    _treeDragging = false;
    _treeCanvas.style.cursor = 'default';
  }
}

function onTreeCanvasClick(e) {
  if (!_treeGraph || !_treeHovered) return;
  const { hash, node } = _treeHovered;
  if (_showTreeDebug) {
    console.info("[Tree] clicked node ID:", node.sid || hash, { hash, name: node.name });
  }
  if (node.type === 'start') return; // class start nodes are implicit

  if (node.ascendancy) {
    toggleAscendancyTreeNode(hash, node);
    serializeAllocatedTreeToBuild();
    rerenderEditablePanels();
    scheduleTreeRender();
    return;
  }

  if (_treeAllocated.has(hash)) {
    _treeAllocated.delete(hash);
  } else {
    _treeAllocated.add(hash);
  }

  // Sync back to GGG ID string list in active build
  serializeAllocatedTreeToBuild();
  
  // Refresh all other panels and tab views
  rerenderEditablePanels();
}

function toggleAscendancyTreeNode(hash, node) {
  const asc = node.ascendancy;
  if (!asc) return;
  if (_selectedAscendancyId && _selectedAscendancyId.toLowerCase() !== asc.toLowerCase()) return;
  if (!_selectedAscendancyId) {
    _selectedAscendancyId = asc;
    if (lastBuild) lastBuild.ascendancy = asc;
  }

  const startHash = findTreeAscendancyStartHash(asc);
  const adjacency = buildTreeAdjacency();
  const allow = h => {
    const n = _treeData?.nodes?.[h];
    return !!n?.a && String(n.a).toLowerCase() === asc.toLowerCase();
  };

  if (_treeAllocated.has(hash)) {
    _treeAllocated.delete(hash);
    repairCurrentAscendancyAllocation(asc, adjacency, startHash, allow);
    return;
  }

  const selected = new Set([startHash, ...[..._treeAllocated].filter(h => allow(h))].filter(Boolean));
  const path = shortestTreePathFromSet(selected, hash, adjacency, allow);
  if (!path) return;

  const currentCount = [..._treeAllocated].filter(h => allow(h) && shouldDrawAllocatedPreviewNode(h)).length;
  const additions = path.filter(h => shouldDrawAllocatedPreviewNode(h) && !_treeAllocated.has(h));
  if (currentCount + additions.length > 8) return;
  for (const h of additions) _treeAllocated.add(h);
}

function repairCurrentAscendancyAllocation(asc, adjacency, startHash, allow) {
  const targets = [..._treeAllocated]
    .map((hash, index) => ({ hash, index }))
    .filter(({ hash }) => allow(hash) && shouldDrawAllocatedPreviewNode(hash));
  for (const hash of [..._treeAllocated]) {
    if (allow(hash)) _treeAllocated.delete(hash);
  }
  const repaired = connectPreviewTargets(targets, { adjacency, startHash, max: 8, allow });
  for (const hash of repaired.hashes) _treeAllocated.add(hash);
}

function onTreeMouseMove(e) {
  if (!_treeGraph) return;
  
  const rect = _treeCanvas.getBoundingClientRect();
  const dpr  = devicePixelRatio;
  const mx   = (e.clientX - rect.left)  * dpr;
  const my   = (e.clientY - rect.top)   * dpr;

  if (_treeViewMode === 'ascendancy-overview') {
    _treeHoveredCard = null;
    const options = CLASS_TO_ASCENDANCIES[lastBuild?.class] || [];
    const count = options.length;
    for (let i = 0; i < count; i++) {
      const name = options[i];
      let cx, cy, r;
      if (count <= 3) {
        cx = _treeCanvas.width / (count + 1) * (i + 1);
        cy = _treeCanvas.height / 2;
        r = 95 * devicePixelRatio;
      } else {
        const cols = 5;
        const col = i % cols;
        const row = Math.floor(i / cols);
        cx = (_treeCanvas.width / (cols + 1)) * (col + 1);
        cy = (_treeCanvas.height / 5) * (row + 1);
        r = 45 * devicePixelRatio;
      }
      const d = Math.hypot(cx - mx, cy - my);
      if (d < r) {
        _treeHoveredCard = { id: name, name, x: cx, y: cy, radius: r };
        break;
      }
    }
    
    if (_treeHoveredCard) {
      _treeCanvas.style.cursor = 'pointer';
    } else {
      _treeCanvas.style.cursor = 'default';
    }
    scheduleTreeRender();
    return;
  }

  if (_treeDragging && _treeDragStart) {
    _treePanX = _treeDragStart.px - (e.clientX - _treeDragStart.x) * devicePixelRatio / _treeZoom;
    _treePanY = _treeDragStart.py - (e.clientY - _treeDragStart.y) * devicePixelRatio / _treeZoom;
    scheduleTreeRender();
    return;
  }

  const wx     = (mx - _treeCanvas.width  / 2) / _treeZoom + _treePanX;
  const wy     = (my - _treeCanvas.height / 2) / _treeZoom + _treePanY;
  const thresh = 300 / _treeZoom;

  let best = null, bestD = thresh;
  for (const node of _treeGraph.nodes.values()) {
    if (!shouldRenderTreeNode(node)) continue;
    const d = Math.hypot(node.x - wx, node.y - wy);
    if (d < bestD) { bestD = d; best = { hash: node.id, node }; }
  }
  
  if (best?.hash !== _treeHovered?.hash) {
    _treeHovered = best;
    if (_treeHovered) {
      _treeCanvas.style.cursor = 'pointer';
    } else {
      _treeCanvas.style.cursor = 'grab';
    }
    updateTreeDebugPanel();
    scheduleTreeRender();
  }
}

function scheduleTreeRender() {
  if (_treeFrame) return;
  _treeFrame = requestAnimationFrame(() => { _treeFrame = null; renderTree(); });
}

function shouldRenderTreeNode(node) {
  if (!node) return false;
  if (_treeViewMode === 'main') {
    return !node.ascendancy;
  }
  if (_treeViewMode === 'ascendancy-detail') {
    if (!node.ascendancy) return false;
    // If we have a resolved ID, only show that class; otherwise show all ascendancy nodes
    if (!_selectedAscendancyId) return true;
    return node.ascendancy.toLowerCase() === _selectedAscendancyId.toLowerCase();
  }
  return false;
}

function treeNodeVisualRadius(node) {
  return { keystone: 76, notable: 46, normal: 27, jewel: 52, ascendancy: 43, start: 24 }[node.type] || 27;
}

function drawTreeArc(ctx, cx, cy, radius, a1, a2) {
  let delta = a2 - a1;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  ctx.moveTo(cx + radius * Math.cos(a1), cy + radius * Math.sin(a1));
  ctx.arc(cx, cy, radius, a1, a1 + delta, delta < 0);
}

function drawTreeConnection(ctx, node, target, orbit) {
  if (!node || !target || node.ascendancy !== target.ascendancy) return;

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

  if (node.group && node.group === target.group && node.o === target.o && node.R > 0) {
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

function renderEdges(ctx, graph, z) {
  if (!graph || !graph.edges.length) return;

  // Visual Stroke Scale (keeps edges legible regardless of zoom level)
  const minUnallocWidth = Math.max(4, 1.25 / z);
  const minAllocWidth   = Math.max(10, 2.5 / z);
  const minAllocCore    = Math.max(3, 0.75 / z);

  // 1. Draw Unallocated Edges (Dim Bronze Gold)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(163,141,109,0.32)';
  ctx.lineWidth = minUnallocWidth;

  for (const edge of graph.edges) {
    if (edge.isAllocated) continue;
    
    const sNode = graph.nodes.get(edge.sourceId);
    const tNode = graph.nodes.get(edge.targetId);

    if (!sNode || !tNode) continue;
    if (!shouldRenderTreeNode(sNode) || !shouldRenderTreeNode(tNode)) continue;

    drawTreeConnection(ctx, sNode, tNode, edge.orbit);
  }
  ctx.stroke();

  // 2. Draw Allocated Edges Glow (Thin Glowing Gold)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(212,175,55,0.4)';
  ctx.lineWidth = minAllocWidth;

  for (const edge of graph.edges) {
    if (!edge.isAllocated) continue;

    const sNode = graph.nodes.get(edge.sourceId);
    const tNode = graph.nodes.get(edge.targetId);

    if (!sNode || !tNode) continue;
    if (!shouldRenderTreeNode(sNode) || !shouldRenderTreeNode(tNode)) continue;

    drawTreeConnection(ctx, sNode, tNode, edge.orbit);
  }
  ctx.stroke();

  // 3. Draw Allocated Edges Core (Thin Bright Gold/White core)
  ctx.beginPath();
  ctx.strokeStyle = '#fffbeb';
  ctx.lineWidth = minAllocCore;

  for (const edge of graph.edges) {
    if (!edge.isAllocated) continue;

    const sNode = graph.nodes.get(edge.sourceId);
    const tNode = graph.nodes.get(edge.targetId);

    if (!sNode || !tNode) continue;
    if (!shouldRenderTreeNode(sNode) || !shouldRenderTreeNode(tNode)) continue;

    drawTreeConnection(ctx, sNode, tNode, edge.orbit);
  }
  ctx.stroke();
}

function renderAscendancyPlates(ctx, graph, z) {
  if (_treeViewMode !== 'ascendancy-detail' || !graph || !_selectedAscendancyId) return;
  
  const groupNodes = [];
  for (const node of graph.nodes.values()) {
    if (node.ascendancy && node.ascendancy.toLowerCase() === _selectedAscendancyId.toLowerCase()) {
      groupNodes.push(node);
    }
  }
  
  if (!groupNodes.length) return;
  
  // Calculate bounding center of ascendancy cluster
  let sumX = 0, sumY = 0;
  for (const node of groupNodes) {
    sumX += node.x;
    sumY += node.y;
  }
  const cx = sumX / groupNodes.length;
  const cy = sumY / groupNodes.length;
  
  const rPlate = 900;
  
  ctx.save();
  
  // Draw Tiled Plate Background Plate with coppery center gradient
  const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, rPlate);
  grad.addColorStop(0, 'rgba(32, 26, 18, 0.72)');
  grad.addColorStop(0.7, 'rgba(20, 16, 11, 0.88)');
  grad.addColorStop(1, 'rgba(8, 7, 5, 0.98)');
  ctx.fillStyle = grad;
  
  ctx.beginPath();
  ctx.arc(cx, cy, rPlate, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw outer coppery framing outline
  ctx.strokeStyle = 'rgba(184, 137, 72, 0.52)';
  ctx.lineWidth = Math.max(12, 3 / z);
  ctx.stroke();
  
  // Draw decorative inner metal ring
  ctx.beginPath();
  ctx.arc(cx, cy, rPlate - 40, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(184, 137, 72, 0.28)';
  ctx.lineWidth = Math.max(4, 1 / z);
  ctx.stroke();
  
  // Render serif Ascendancy Class label
  ctx.font = `bold ${Math.max(50, 12 / z)}px Georgia, serif`;
  ctx.fillStyle = '#dfb77d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 15;
  
  ctx.fillText(_selectedAscendancyId.toUpperCase(), cx, cy - rPlate + 140);
  
  ctx.restore();
}

function renderNodes(ctx, graph, z) {
  if (!graph || !graph.nodes.size) return;

  const minRadiusPx = 2.5;

  for (const node of graph.nodes.values()) {
    if (!shouldRenderTreeNode(node)) continue;

    const baseRadius = treeNodeVisualRadius(node);
    const r = Math.max(baseRadius, minRadiusPx / z);
    const isAlloc = node.allocated;
    const isHover = _treeHovered?.hash === node.id;

    // Allocated node gold-orange glowing backdrop halo
    if (isAlloc) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 26, 0, Math.PI * 2);
      ctx.fillStyle = node.ascendancy ? 'rgba(210,145,52,0.18)' : 'rgba(231,225,112,0.16)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

    if (isAlloc) {
      // Allocated nodes: bright copper/gold core with glowing borders
      ctx.fillStyle = node.ascendancy ? '#d29134' : '#dfc45f';
      ctx.strokeStyle = '#fff0a8';
      ctx.lineWidth = Math.max(9, 1.35 / z);
    } else if (isHover) {
      // Hovered nodes
      ctx.fillStyle = '#22232c';
      ctx.strokeStyle = '#d4c070';
      ctx.lineWidth = Math.max(7, 1 / z);
    } else {
      // Unallocated nodes: highly dimmed metallic frames
      ctx.fillStyle = node.type === 'keystone' ? '#111319'
                    : node.type === 'notable' ? '#0b0d10'
                    : node.type === 'jewel' ? '#040506' // Hollow dark socket core
                    : node.ascendancy ? '#100c0c'
                    : '#040505';
      ctx.strokeStyle = node.type === 'keystone' ? '#5a4c28'
                      : node.type === 'notable' ? '#443b20'
                      : node.type === 'start' ? '#4e4b39'
                      : '#28241a';
      ctx.lineWidth = Math.max(4, 0.75 / z);
    }
    ctx.fill();
    ctx.stroke();

    // Secondary inner visual core rings for keystones, notables, and jewel sockets
    if (node.type === 'notable' || node.type === 'keystone' || node.type === 'jewel') {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 0.58, 0, Math.PI * 2);
      if (node.type === 'jewel') {
        // Hollow dash-pattern for socket frame
        ctx.strokeStyle = isAlloc ? 'rgba(255,245,170,0.65)' : 'rgba(92,80,51,0.5)';
        ctx.setLineDash([Math.max(6, 1.5 / z), Math.max(4, 1 / z)]);
      } else {
        ctx.strokeStyle = isAlloc ? 'rgba(255,245,170,0.65)' : 'rgba(104,91,55,0.4)';
      }
      ctx.lineWidth = Math.max(3, 0.55 / z);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash
    }
  }
}

function renderPobTreeCanvas(ctx, nodes, W, H, z, ox, oy) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Render Large Ascendancy plates first (behind unallocated edges)
  renderAscendancyPlates(ctx, _treeGraph, z);

  // 2. Render edge connections layer
  renderEdges(ctx, _treeGraph, z);

  // 3. Render passive nodes layer
  renderNodes(ctx, _treeGraph, z);

  ctx.restore();
  drawTreeTooltip(ctx, W, H, z, ox, oy);
}

function drawTreeTooltip(ctx, W, H, z, ox, oy) {
  if (!_treeHovered) return;
  const { hash, node } = _treeHovered;
  const sx = node.x * z + ox;
  const sy = node.y * z + oy;
  const isAlloc = node.allocated;
  const label = node.name || hash;
  const typeLabel = { keystone: 'Keystone', notable: 'Notable', jewel: 'Jewel Socket',
                      ascendancy: 'Ascendancy', start: 'Class Start', normal: 'Passive' }[node.type] || 'Passive';
  const stats = Array.isArray(node.stats) ? node.stats.slice(0, 2).join(' | ') : '';

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
  
  if (_treeViewMode === 'ascendancy-overview') {
    drawRadialBackground(ctx, W, H);
    renderAscendancyOverviewScreen(ctx, W, H);
    return;
  }

  const z = _treeZoom;
  const ox = W / 2 - _treePanX * z;
  const oy = H / 2 - _treePanY * z;

  // Layer 1: Dark Indigo Radial Background Grid
  const bgImg = _treeAssets.images['bg_tile'];
  if (bgImg) {
    ctx.save();
    const pattern = ctx.createPattern(bgImg, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W, H);
      
      // Radial dark overlay to dim the pattern at boundaries
      const overlayGrad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, Math.max(W, H));
      overlayGrad.addColorStop(0, 'rgba(9, 13, 22, 0.45)');
      overlayGrad.addColorStop(0.7, 'rgba(4, 6, 9, 0.82)');
      overlayGrad.addColorStop(1, 'rgba(1, 2, 3, 0.98)');
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, W, H);
    } else {
      drawRadialBackground(ctx, W, H);
    }
    ctx.restore();
  } else {
    drawRadialBackground(ctx, W, H);
  }

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(z, z);

  const nodes = _treeData.nodes;
  renderPobTreeCanvas(ctx, nodes, W, H, z, ox, oy);
  return;
}

function drawRadialBackground(ctx, W, H) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H));
  grad.addColorStop(0, '#090d16');
  grad.addColorStop(0.7, '#040609');
  grad.addColorStop(1, '#010203');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
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
  return !!node && node.t !== 'start' && !isTreeAscendancyRootNode(node);
}

function findTreeAscendancyStartHash(ascendancy) {
  const wanted = String(ascendancy || '').trim().toLowerCase();
  if (!wanted) return null;
  const found = Object.entries(_treeData?.nodes || {}).find(([, node]) =>
    node.a && String(node.a).toLowerCase() === wanted && node.t === 'ascendancy' && String(node.n).toLowerCase() === wanted
  );
  return found?.[0] || null;
}

function isTreeAscendancyRootNode(node) {
  const ascendancy = node?.a || node?.ascendancy;
  const type = node?.t || node?.type;
  const name = node?.n || node?.name;
  return !!ascendancy && type === 'ascendancy' && String(name || '').toLowerCase() === String(ascendancy || '').toLowerCase();
}

function updateTreeControlsOverlay() {
  const container = $('tree-controls-overlay');
  if (!container) return;

  if (_treeViewMode === 'main') {
    container.innerHTML = `
      <button id="tree-asc-btn" class="ghost sm" type="button">Show Ascendancy</button>
      <button id="tree-reset-btn" class="ghost sm" type="button">Reset View</button>
      <button id="tree-debug-btn" class="ghost sm" type="button">${_showTreeDebug ? 'Hide Debug' : 'Debug'}</button>
    `;
    $('tree-asc-btn').onclick = () => {
      if (_selectedAscendancyId) {
        _treeViewMode = 'ascendancy-detail';
      } else {
        _treeViewMode = 'ascendancy-overview';
      }
      updateTreeControlsOverlay();
      fitTreeView();
      scheduleTreeRender();
    };
    $('tree-reset-btn').onclick = () => {
      fitTreeView();
      scheduleTreeRender();
    };
    $('tree-debug-btn').onclick = toggleTreeDebug;
  } else if (_treeViewMode === 'ascendancy-overview') {
    container.innerHTML = `
      <button id="tree-back-main-btn" class="ghost sm" type="button">Back to Main Tree</button>
      <button id="tree-debug-btn" class="ghost sm" type="button">${_showTreeDebug ? 'Hide Debug' : 'Debug'}</button>
    `;
    $('tree-back-main-btn').onclick = () => {
      _treeViewMode = 'main';
      updateTreeControlsOverlay();
      fitTreeView();
      scheduleTreeRender();
    };
    $('tree-debug-btn').onclick = toggleTreeDebug;
  } else if (_treeViewMode === 'ascendancy-detail') {
    container.innerHTML = `
      <button id="tree-back-overview-btn" class="ghost sm" type="button">Back to Ascendancy Select</button>
      <button id="tree-back-main-btn" class="ghost sm" type="button">Back to Main Tree</button>
      <button id="tree-reset-btn" class="ghost sm" type="button">Reset View</button>
      <button id="tree-debug-btn" class="ghost sm" type="button">${_showTreeDebug ? 'Hide Debug' : 'Debug'}</button>
    `;
    $('tree-back-overview-btn').onclick = () => {
      _treeViewMode = 'ascendancy-overview';
      updateTreeControlsOverlay();
      scheduleTreeRender();
    };
    $('tree-back-main-btn').onclick = () => {
      _treeViewMode = 'main';
      updateTreeControlsOverlay();
      fitTreeView();
      scheduleTreeRender();
    };
    $('tree-reset-btn').onclick = () => {
      fitTreeView();
      scheduleTreeRender();
    };
    $('tree-debug-btn').onclick = toggleTreeDebug;
  }
  updateTreeDebugPanel();
}

function toggleTreeDebug() {
  _showTreeDebug = !_showTreeDebug;
  updateTreeControlsOverlay();
  updateTreeDebugPanel();
  scheduleTreeRender();
}

function updateTreeDebugPanel() {
  const panel = $('tree-debug-panel');
  if (!panel) return;
  panel.style.display = _showTreeDebug ? 'block' : 'none';
  if (!_showTreeDebug) return;

  const missing = _treeValidation.missingIds || [];
  const hoveredId = _treeHovered?.node?.sid || _treeHovered?.hash || 'none';
  panel.innerHTML = `
    <div><strong>Tree Debug</strong></div>
    <div>Imported IDs: ${_treeValidation.importedCount || 0}</div>
    <div>Matched IDs: ${_treeValidation.matchedCount || 0}</div>
    <div>Missing IDs: ${missing.length}</div>
    <div>Allocated edges: ${_treeValidation.allocatedEdgeCount || 0}</div>
    <div>Hovered ID: ${esc(hoveredId)}</div>
    ${missing.length ? `<div class="tree-debug-missing">${esc(missing.slice(0, 8).join(', '))}${missing.length > 8 ? '...' : ''}</div>` : ''}
  `;
}

function renderAscendancyOverviewScreen(ctx, W, H) {
  const options = CLASS_TO_ASCENDANCIES[lastBuild?.class] || [];
  const count = options.length;
  if (count === 0) {
    ctx.font = `bold ${22 * devicePixelRatio}px Georgia, serif`;
    ctx.fillStyle = '#dfb77d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("NO ASCENDANCY OPTIONS AVAILABLE FOR CLASS", W / 2, H / 2);
    return;
  }

  // Draw background title
  ctx.font = `bold ${18 * devicePixelRatio}px Georgia, serif`;
  ctx.fillStyle = '#dfb77d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText("CHOOSE YOUR ASCENDANCY CLASS", W / 2, 28 * devicePixelRatio);

  for (let i = 0; i < count; i++) {
    const name = options[i];
    let cx, cy, r;
    if (count <= 3) {
      cx = W / (count + 1) * (i + 1);
      cy = H / 2;
      r = 95 * devicePixelRatio;
    } else {
      const cols = 5;
      const col = i % cols;
      const row = Math.floor(i / cols);
      cx = (W / (cols + 1)) * (col + 1);
      cy = (H / 5) * (row + 1);
      r = 45 * devicePixelRatio;
    }

    const isHover = _treeHoveredCard && _treeHoveredCard.id === name;
    const isSelected = _selectedAscendancyId && _selectedAscendancyId.toLowerCase() === name.toLowerCase();
    const drawR = isHover ? r * 1.05 : r;

    ctx.save();

    // 1. Glowing outer halo for selected / hovered
    if (isSelected || isHover) {
      ctx.beginPath();
      ctx.arc(cx, cy, drawR + (isSelected ? 10 * devicePixelRatio : 6 * devicePixelRatio), 0, Math.PI * 2);
      ctx.shadowColor = isSelected ? '#d29134' : '#b88948';
      ctx.shadowBlur = 20 * devicePixelRatio;
      ctx.fillStyle = isSelected ? 'rgba(210,145,52,0.15)' : 'rgba(184,137,72,0.08)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 2. Main card body radial gradient
    ctx.beginPath();
    ctx.arc(cx, cy, drawR, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, drawR);
    grad.addColorStop(0, '#221710');
    grad.addColorStop(0.7, '#14100b');
    grad.addColorStop(1, '#080705');
    ctx.fillStyle = grad;
    ctx.fill();

    // 3. Card border
    ctx.strokeStyle = isSelected ? '#dfb77d' : isHover ? '#b88948' : 'rgba(184, 137, 72, 0.35)';
    ctx.lineWidth = (isSelected ? 5 : isHover ? 4 : 2.5) * devicePixelRatio;
    ctx.stroke();

    // 4. Decorative inner metal ring
    ctx.beginPath();
    ctx.arc(cx, cy, drawR - 8 * devicePixelRatio, 0, Math.PI * 2);
    ctx.strokeStyle = isSelected ? 'rgba(223,183,125,0.25)' : 'rgba(184,137,72,0.15)';
    ctx.lineWidth = 1 * devicePixelRatio;
    ctx.stroke();

    // 5. Render serif Ascendancy name
    const fontSize = Math.max(12, (count <= 3 ? 16 : 11) * devicePixelRatio);
    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.fillStyle = isSelected ? '#fffbeb' : isHover ? '#dfb77d' : '#b88948';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nameY = cy - (count <= 3 ? 10 : 2) * devicePixelRatio;
    ctx.fillText(name.toUpperCase(), cx, nameY);

    // 6. For larger cards: underline + base class
    if (count <= 3) {
      ctx.beginPath();
      ctx.moveTo(cx - 40 * devicePixelRatio, cy + 8 * devicePixelRatio);
      ctx.lineTo(cx + 40 * devicePixelRatio, cy + 8 * devicePixelRatio);
      ctx.strokeStyle = 'rgba(184, 137, 72, 0.25)';
      ctx.lineWidth = 1 * devicePixelRatio;
      ctx.stroke();

      ctx.font = `italic ${11 * devicePixelRatio}px system-ui, sans-serif`;
      ctx.fillStyle = '#8f8668';
      ctx.fillText(`(${lastBuild?.class || 'Class'})`, cx, cy + 22 * devicePixelRatio);
    }

    // 7. "Selected" checkmark badge for selected ascendancy
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(cx + drawR * 0.65, cy - drawR * 0.65, 9 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fillStyle = '#d29134';
      ctx.fill();
      ctx.font = `bold ${10 * devicePixelRatio}px system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', cx + drawR * 0.65, cy - drawR * 0.65);
    }

    ctx.restore();
  }
}

// ── Standalone crafting page init ──────────────────────────────────────────
if (document.body.dataset.page === 'crafting') {
  document.addEventListener('DOMContentLoaded', openCraftingSimulator);
}
