const $ = (id) => document.getElementById(id);

let lastBuild = null;
let lastFilename = 'MyBuild.build';
let selectedKind = 'auto';

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

async function convert() {
  const input = $('input').value.trim();
  if (!input) {
    setStatus('Paste a PoB code or pobb.in link first.', 'error');
    return;
  }

  setStatus('Converting…', '');
  $('convert-btn').disabled = true;

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        kind: selectedKind,
        name: $('name').value.trim() || undefined,
        description: $('description').value.trim() || undefined,
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
