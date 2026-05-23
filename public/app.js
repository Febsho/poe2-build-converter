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

// ── Tab management ─────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === name)
  );
  document.querySelectorAll('.tab-panel').forEach((p) =>
    p.classList.toggle('active', p.id === `tab-${name}`)
  );
}

// ── Drag & drop ────────────────────────────────────────────────────────────
(function initDragDrop() {
  const zone    = $('drop-zone');
  const inputEl = $('input');

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
$('input').addEventListener('input', () => {
  inspectedInput = null;
  availableSets  = null;
  $('set-selector').classList.add('hidden');
});

$('input').addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') convert();
});

['sel-gems', 'sel-gear', 'sel-tree'].forEach((id) =>
  $(id)?.addEventListener('change', () => doConvert())
);

$('convert-btn').addEventListener('click', convert);
$('download').addEventListener('click', download);
$('copy').addEventListener('click', copyJson);

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
  const hash = location.hash;
  if (hash && hash.length > 1) {
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
  renderProblemsTab(r);

  // JSON tab — editable textarea
  lastImportedBuildRaw = JSON.stringify(b, null, 2);
  syncJsonEditorFromBuild(true);

  // Problems badge
  const issues = r.guessed.length + r.unsupported.length;
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
    section('ph-warnings',    '📝', 'Notes',       r.warnings);
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
  syncJsonEditorFromBuild();
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
