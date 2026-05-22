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
  const { build: b, report: r, source, passiveNames = {} } = data;

  // Stat cards
  $('stat-converted').textContent   = r.converted.length;
  $('stat-guessed').textContent     = r.guessed.length;
  $('stat-unsupported').textContent = r.unsupported.length;
  $('stat-source').textContent      = source?.kind ?? '—';

  renderOverviewTab(b, r, source);
  renderSkillsTab(b.skills ?? [], data.preview?.skills ?? []);
  renderPassivesTab(b.passives ?? [], r, passiveNames);
  renderItemsTab(b.items ?? []);
  renderProblemsTab(r);

  // JSON tab — editable textarea
  lastBuildRaw = JSON.stringify(b, null, 2);
  const jsonEl = $('json');
  if (jsonEl) {
    jsonEl.value = lastBuildRaw;
    const statusEl = $('json-status');
    if (statusEl) statusEl.textContent = '';
  }

  // Problems badge
  const issues = r.guessed.length + r.unsupported.length;
  const badge  = $('problems-badge');
  badge.textContent = issues;
  badge.classList.toggle('hidden', issues === 0);

  $('download').disabled = false;
  $('results').classList.remove('hidden');
  switchTab('overview');

  // Quality warnings (shown above results section)
  showQualityWarnings(b, r);
}

// ── Quality warnings ───────────────────────────────────────────────────────
function showQualityWarnings(build, report) {
  const banner = $('quality-banner');
  const msg    = $('quality-banner-msg');
  if (!banner || !msg) return;

  const issues = [];
  if (!build.skills?.length)                              issues.push('no skill gems');
  if (!build.passives?.length)                            issues.push('no passive nodes');
  if (!build.ascendancy)                                  issues.push('no ascendancy');
  if (report.guessed.some((l) => /ascendancy/i.test(l))) issues.push('ascendancy unverified');
  if (!build.items?.length)                               issues.push('no items');
  if (report.unsupported.length > 3)                     issues.push(`${report.unsupported.length} unsupported entries`);

  if (issues.length) {
    msg.textContent = 'Heads up — ' + issues.join(' · ');
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// ── Overview ───────────────────────────────────────────────────────────────
function renderOverviewTab(build, report, source) {
  const ascLine    = report.converted.find((l) => l.startsWith('ascendancy'));
  const ascMatch   = ascLine?.match(/^ascendancy "([^"]+)"/);
  const ascDisplay = ascMatch?.[1] || build.ascendancy || '';
  const className  = build.meta?.className ?? '';

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
function renderSkillsTab(skills, previewSkills = []) {
  const copyBtn = `<button class="section-copy-btn ghost sm" onclick="copySection('skills')">Copy JSON</button>`;

  if (previewSkills.length) {
    const html = previewSkills.map((group) => {
      const active      = group.actives?.[0];
      const primaryName = displayGemName(active) || 'Unknown Skill';
      const extraActives = (group.actives ?? []).slice(1);

      const supportRows = (group.supports ?? []).map((gem) =>
        `<li>
          <span class="gem-ico">◈</span>
          <span class="gem-name">${esc(displayGemName(gem))}</span>
          ${renderGemLevelTag(gem)}
        </li>`
      ).join('');

      const extraActiveRows = extraActives.map((gem) =>
        `<li>
          <span class="gem-ico">◆</span>
          <span class="gem-name">${esc(displayGemName(gem))}</span>
          ${renderGemLevelTag(gem)}
        </li>`
      ).join('');

      const intervalTag = renderIntervalTag(group.level_interval);

      return `
        <li class="gem-group">
          <div class="gem-active">
            <span class="gem-ico">◆</span>
            <span class="gem-name">${esc(primaryName)}</span>
            ${renderGemLevelTag(active)}
            ${intervalTag}
          </div>
          ${(group.slot || extraActiveRows || supportRows) ? `
            <div class="gem-meta-row">
              ${group.slot ? `<span class="tag">${esc(group.slot)}</span>` : ''}
            </div>` : ''}
          ${(extraActiveRows || supportRows)
            ? `<ul class="gem-supports">${extraActiveRows}${supportRows}</ul>`
            : ''}
        </li>`;
    }).join('');

    $('tab-skills').innerHTML =
      `<div class="tab-section-header">${copyBtn}</div><ul class="gem-list">${html}</ul>`;
    return;
  }

  if (!skills.length) {
    $('tab-skills').innerHTML =
      `<div class="tab-section-header">${copyBtn}</div><p class="empty-msg">No skills found in this build.</p>`;
    return;
  }

  const html = skills.map((s) => {
    const id            = typeof s === 'string' ? s : s.id;
    const supports      = typeof s === 'object' ? (s.support_skills ?? []) : [];
    const interval      = typeof s === 'object' ? s.level_interval : null;
    const additionalTxt = typeof s === 'object' ? s.additional_text : null;

    const supRows = supports.map((sid) => {
      const supportId  = typeof sid === 'string' ? sid : (sid?.id ?? '');
      const supportTxt = typeof sid === 'object' ? (sid.additional_text ?? '') : '';
      return `<li>
        <span class="gem-ico">◈</span>
        <span class="gem-name">${esc(gemName(supportId))}</span>
        ${supportTxt ? `<span class="tag">${esc(supportTxt.slice(0, 30))}</span>` : ''}
      </li>`;
    }).join('');

    return `
      <li class="gem-group">
        <div class="gem-active">
          <span class="gem-ico">◆</span>
          <span class="gem-name">${esc(gemName(id))}</span>
          ${renderIntervalTag(interval)}
        </div>
        ${additionalTxt
          ? `<div class="gem-meta-row"><span class="gem-additional">${esc(additionalTxt)}</span></div>`
          : ''}
        ${supRows ? `<ul class="gem-supports">${supRows}</ul>` : ''}
      </li>`;
  }).join('');

  $('tab-skills').innerHTML =
    `<div class="tab-section-header">${copyBtn}</div><ul class="gem-list">${html}</ul>`;
}

// ── Passives ───────────────────────────────────────────────────────────────
function renderPassivesTab(passives, report, passiveNames = {}) {
  const total        = passives.length;
  const withInterval = passives.filter((p) => typeof p === 'object' && p.level_interval).length;
  const mainPassives = passives.filter((p) => !isWeaponSetPassive(p));
  const weaponSet1   = passives.filter((p) => getWeaponSet(p) === 1);
  const weaponSet2   = passives.filter((p) => getWeaponSet(p) === 2);

  const line       = report.guessed.find((l) => /passive node/i.test(l));
  const unresolved = line ? (parseInt(line.match(/(\d+)/)?.[1] ?? '0', 10)) : 0;

  const sections = [
    renderPassiveSection('Main Tree',    mainPassives, passiveNames),
    renderPassiveSection('Weapon Set 1', weaponSet1,   passiveNames),
    renderPassiveSection('Weapon Set 2', weaponSet2,   passiveNames),
  ].filter(Boolean).join('');

  const copyBtn = `<button class="section-copy-btn ghost sm" onclick="copySection('passives')">Copy JSON</button>`;

  $('tab-passives').innerHTML = `
    <div class="tab-section-header">${copyBtn}</div>
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
    ${sections ? `<div class="passives-sections">${sections}</div>` : ''}
  `;
}

function renderPassiveSection(title, passives, passiveNames = {}) {
  if (!passives.length) return '';
  return `
    <div class="passive-section">
      <div class="passive-section-head">
        <h3>${esc(title)}</h3>
        <span class="tag">${passives.length}</span>
      </div>
      <ul class="passive-list">
        ${passives.map((p) => {
          const passive     = normalizePassive(p);
          const displayName = passiveNames[passive.id] || formatPassiveId(passive.id);
          return `
            <li class="passive-item">
              <div class="passive-item-main">
                <span class="passive-id">${esc(displayName)}</span>
                ${passive.levelInterval
                  ? `<span class="passive-meta">Lvl ${passive.levelInterval[0]}+</span>`
                  : ''}
              </div>
              ${passive.levelInterval ? renderPassiveBar(passive.levelInterval) : ''}
            </li>`;
        }).join('')}
      </ul>
    </div>`;
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
function renderItemsTab(items) {
  const copyBtn = `<button class="section-copy-btn ghost sm" onclick="copySection('items')">Copy JSON</button>`;

  if (!items.length) {
    $('tab-items').innerHTML =
      `<div class="tab-section-header">${copyBtn}</div><p class="empty-msg">No items found in this build.</p>`;
    return;
  }

  const rows = items.map((item) => {
    const slot = esc(prettySlot(item.inventory_id));
    let nameCell = '<span class="item-name muted">(empty)</span>';
    let modsCell = '';

    if (item.unique_name) {
      nameCell = `<span class="item-name unique">★ ${esc(item.unique_name)}</span>`;
      if (item.additional_text) {
        modsCell = `<div class="item-mods">${item.additional_text.split('\n').map(esc).join('<br>')}</div>`;
      }
    } else if (item.additional_text) {
      const lines = item.additional_text.split('\n');
      nameCell = `<span class="item-name">${esc(lines[0])}</span>`;
      if (lines.length > 1) {
        modsCell = `<div class="item-mods">${lines.slice(1).map(esc).join('<br>')}</div>`;
      }
    }

    return `<tr>
      <td class="item-slot">${slot}</td>
      <td>${nameCell}${modsCell}</td>
    </tr>`;
  }).join('');

  $('tab-items').innerHTML = `
    <div class="tab-section-header">${copyBtn}</div>
    <table class="items-table">
      <thead><tr><th>Slot</th><th>Item</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Problems ───────────────────────────────────────────────────────────────
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
  jsonEl.value = lastBuildRaw;
  try { lastBuild = JSON.parse(lastBuildRaw); } catch {}
  if (statusEl) statusEl.textContent = '';
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
  if (!lastData?.build) return;
  const payload = {};
  if (section === 'skills')   payload.skills   = lastData.build.skills   ?? [];
  if (section === 'passives') payload.passives  = lastData.build.passives ?? [];
  if (section === 'items')    payload.items     = lastData.build.items    ?? [];
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
    return { id: passive, levelInterval: null, weaponSet: null };
  }
  return {
    id:            passive.id,
    levelInterval: passive.level_interval ?? null,
    weaponSet:     passive.weapon_set     ?? null,
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
