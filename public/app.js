const $ = (id) => document.getElementById(id);

let lastBuild = null;
let lastFilename = 'MyBuild.build';
let selectedKind = 'auto';

// Set selection state
let inspectedInput = null;  // the input string that was last inspected
let availableSets = null;   // { skillSets, itemSets, treeSpecs }

// Segmented input-type control
document.querySelectorAll('#kind-seg .seg').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#kind-seg .seg').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedKind = btn.dataset.kind;
  });
});

// Sidebar nav -> scroll + reveal
document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    item.classList.add('active');
    const el = $(item.dataset.target);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

$('convert-btn').addEventListener('click', convert);
$('download').addEventListener('click', download);
$('copy').addEventListener('click', copyJson);
$('input').addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') convert();
});

// Reset set selectors when input changes
$('input').addEventListener('input', () => {
  inspectedInput = null;
  availableSets = null;
  $('set-selector').classList.add('hidden');
});

// Re-convert when a set selector changes
['sel-gems', 'sel-gear', 'sel-tree'].forEach((id) => {
  $(id)?.addEventListener('change', () => doConvert());
});

async function convert() {
  const input = $('input').value.trim();
  if (!input) {
    setStatus('Paste a PoB code or pobb.in link first.', 'error');
    return;
  }

  // Phase 1: inspect if not done yet for this input
  if (inspectedInput !== input) {
    await inspect(input);
    // inspect sets inspectedInput; if sets found, selectors are shown
    // and we still fall through to convert with defaults
  }

  await doConvert();
}

async function inspect(input) {
  setStatus('Inspecting…', '');
  $('convert-btn').disabled = true;
  try {
    const res = await fetch('/api/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, kind: selectedKind }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return; // silently skip — convert will surface errors

    inspectedInput = input;
    availableSets = { skillSets: data.skillSets, itemSets: data.itemSets, treeSpecs: data.treeSpecs };

    renderSetSelectors(availableSets);
  } catch {
    // non-fatal — convert will surface any real errors
  } finally {
    $('convert-btn').disabled = false;
  }
}

async function doConvert() {
  const input = $('input').value.trim();
  if (!input) return;

  setStatus('Converting…', '');
  $('convert-btn').disabled = true;

  // Read current selector values
  const skillSetId = parseSelValue($('sel-gems')?.value);
  const itemSetId  = parseSelValue($('sel-gear')?.value);
  const specIndex  = parseSelValue($('sel-tree')?.value);

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        kind: selectedKind,
        name: $('name').value.trim() || undefined,
        description: $('description').value.trim() || undefined,
        skillSetId,
        itemSetId,
        specIndex,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    }

    lastBuild = data.build;
    lastFilename = data.filename || 'MyBuild.build';
    renderReport(data);
    setStatus(`Generated ${lastFilename}`, 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
    $('report').classList.add('hidden');
    $('json-card').classList.add('hidden');
  } finally {
    $('convert-btn').disabled = false;
  }
}

function parseSelValue(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function renderSetSelectors({ skillSets, itemSets, treeSpecs }) {
  const hasSets = skillSets.length > 1 || itemSets.length > 1 || treeSpecs.length > 1;
  if (!hasSets) {
    $('set-selector').classList.add('hidden');
    return;
  }

  populateSelect('sel-gems', skillSets, 'id');
  populateSelect('sel-gear', itemSets, 'id');
  populateSelect('sel-tree', treeSpecs, 'index');

  $('gems-field').classList.toggle('hidden', skillSets.length <= 1);
  $('gear-field').classList.toggle('hidden', itemSets.length <= 1);
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
    opt.value = item[valueKey];
    opt.textContent = item.title;
    sel.appendChild(opt);
  }
  // Restore previously selected value if still valid
  if (prev !== '' && [...sel.options].some((o) => o.value === prev)) {
    sel.value = prev;
  }
}

function renderReport(data) {
  $('report').classList.remove('hidden');
  $('json-card').classList.remove('hidden');
  $('download').disabled = false;

  const r = data.report;
  $('stat-converted').textContent = r.converted.length;
  $('stat-guessed').textContent = r.guessed.length;
  $('stat-unsupported').textContent = r.unsupported.length;
  $('stat-source').textContent = data.source?.kind ?? '—';

  $('legend').textContent =
    `${r.converted.length} converted · ${r.guessed.length} guessed · ${r.unsupported.length} unsupported. ` +
    `Review the Guessed and Unsupported columns before using in-game.`;

  fillList('converted', r.converted);
  fillList('guessed', r.guessed);
  fillList('unsupported', r.unsupported);

  const warns = r.warnings || [];
  if (warns.length) {
    $('warnings-wrap').classList.remove('hidden');
    fillList('warnings', warns);
  } else {
    $('warnings-wrap').classList.add('hidden');
  }

  $('json').textContent = JSON.stringify(data.build, null, 2);
}

function fillList(id, items) {
  const ul = $(id);
  ul.innerHTML = '';
  if (!items || !items.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'none';
    ul.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  }
}

function download() {
  if (!lastBuild) return;
  const blob = new Blob([JSON.stringify(lastBuild, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lastFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyJson() {
  if (!lastBuild) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastBuild, null, 2));
    const btn = $('copy');
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => (btn.textContent = orig), 1200);
  } catch {
    setStatus('Clipboard blocked by browser.', 'error');
  }
}

function setStatus(msg, cls) {
  const el = $('status');
  el.textContent = msg;
  el.className = `status ${cls}`;
}
