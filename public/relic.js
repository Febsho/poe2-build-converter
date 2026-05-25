"use strict";

const MAX_LENGTH = 250;

// ── Relic Static Affixes ───────────────────────────────────────────────────
const RELIC_PREFIXES = [
  { id: "rl-p-1", name: "##% chance for each of your Keys to upgrade on completing a Floor", regex: "eac", ranges: [[3, 9]] },
  { id: "rl-p-2", name: "##% chance if you were to lose all your Honour to have # Honour instead", regex: "we", ranges: [[5, 12]], values: [1, 1] },
  { id: "rl-p-3", name: "##% increased Defences", regex: "def", ranges: [[20, 70]] },
  { id: "rl-p-4", name: "##% increased Honour restored", regex: "ored", ranges: [[6, 45]] },
  { id: "rl-p-5", name: "##% increased Movement Speed", regex: "ed mo", ranges: [[3, 10]] },
  { id: "rl-p-6", name: "##% increased maximum Honour", regex: "m honour$", ranges: [[9, 45]] },
  { id: "rl-p-7", name: "##% increased maximum Life", regex: "lif", ranges: [[5, 25]] },
  { id: "rl-p-8", name: "Bosses deal ##% reduced Damage", regex: "es d", ranges: [[6, 10]] },
  { id: "rl-p-9", name: "Bosses take ##% increased Damage", regex: "ses t", ranges: [[11, 30]] },
  { id: "rl-p-10", name: "Gain ## Sacred Water at the start of the Trial", regex: "ial$", ranges: [[30, 59]] },
  { id: "rl-p-11", name: "Monsters deal ##% reduced Damage", regex: "^monsters d", ranges: [[7, 12]] },
  { id: "rl-p-12", name: "Monsters have ##% reduced Attack, Cast and Movement Speed", regex: ",", ranges: [[6, 7]] },
  { id: "rl-p-13", name: "Monsters take ##% increased Damage", regex: "^monsters t", ranges: [[11, 30]] },
  { id: "rl-p-14", name: "Rare Monsters deal ##% reduced Damage", regex: "e monsters d", ranges: [[6, 10]] },
  { id: "rl-p-15", name: "Rare Monsters take ##% increased Damage", regex: "e monsters t", ranges: [[11, 30]] },
  { id: "rl-p-16", name: "The Merchant has an additional Choice", regex: "cho", ranges: [] },
  { id: "rl-p-17", name: "Traps deal ##% reduced Damage", regex: "ps", ranges: [[6, 15]] },
  { id: "rl-p-18", name: "When you gain a Key ##% chance to gain another", regex: "^w", ranges: [[7, 16]] }
].sort((a, b) => a.name.localeCompare(b.name));

const RELIC_SUFFIXES = [
  { id: "rl-s-1", name: "## additional Rooms are revealed on the Trial Map", regex: "ms", ranges: [[2, 3]] },
  { id: "rl-s-2", name: "##% chance to Avoid gaining an Affliction", regex: "vo", ranges: [[6, 15]] },
  { id: "rl-s-3", name: "##% increased quantity of Keys dropped by Monsters", regex: "f k", ranges: [[6, 25]] },
  { id: "rl-s-4", name: "##% increased quantity of Relics dropped by Monsters", regex: "cs d", ranges: [[6, 20]] },
  { id: "rl-s-5", name: "##% reduced Merchant Prices", regex: "pr", ranges: [[6, 10]] },
  { id: "rl-s-6", name: "##% reduced Slowing Potency of Debuffs on You", regex: "sl", ranges: [[8, 20]] },
  { id: "rl-s-7", name: "+##% to Honour Resistance", regex: "o ho", ranges: [[8, 40]] },
  { id: "rl-s-8", name: "+##% to Maximum Honour Resistance", regex: "o m", ranges: [[2, 5]] },
  { id: "rl-s-9", name: "+(#.#-#.#) metres to Dodge Roll distance", regex: "od", ranges: [], values: [0, 5, 0, 7, 0, 3, 0, 4] },
  { id: "rl-s-10", name: "An additional Room is revealed on the Trial Map", regex: "m i", ranges: [] },
  { id: "rl-s-11", name: "Fountains have ##% chance to grant double Sacred Water", regex: "^f", ranges: [[5, 15]] },
  { id: "rl-s-12", name: "Gain ## Sacred Water when you complete a Room", regex: "ete", ranges: [[11, 30]] },
  { id: "rl-s-13", name: "Hits against you have ##% reduced Critical Damage Bonus", regex: "ts", ranges: [[12, 25]] },
  { id: "rl-s-14", name: "Monsters have ##% chance to drop double Sacred Water", regex: "p d", ranges: [[5, 15]] },
  { id: "rl-s-15", name: "Restore ## Honour on killing a Boss", regex: "kil", ranges: [[40, 150]] },
  { id: "rl-s-16", name: "Restore ## Honour on picking up a Key", regex: "ick", ranges: [[25, 75]] },
  { id: "rl-s-17", name: "Restore ## Honour on room completion", regex: "etio", ranges: [[10, 30]] },
  { id: "rl-s-18", name: "Restore ## Honour on venerating a Maraketh Shrine", regex: "hr", ranges: [[25, 75]] }
].sort((a, b) => a.name.localeCompare(b.name));

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  mode: "relic",
  rlPrefixList: [],
  rlSuffixList: [],
  lastChunks: [],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ── Initialization ─────────────────────────────────────────────────────────
function init() {
  bindEvents();
  renderRelicsLists();
  rebuild();
}

function bindEvents() {
  // Relic event bindings
  $("#rl-prefix-filter").addEventListener("input", (e) => {
    renderSelectList("#relic-prefixes-list", RELIC_PREFIXES, state.rlPrefixList, e.target.value);
  });
  $("#rl-suffix-filter").addEventListener("input", (e) => {
    renderSelectList("#relic-suffixes-list", RELIC_SUFFIXES, state.rlSuffixList, e.target.value);
  });
  $$("input[name='rl-match-type']").forEach(el => el.addEventListener("change", rebuild));

  // Custom & testing terms
  $("#vr-custom").addEventListener("input", rebuild);
  $("#vr-custom-regex").addEventListener("change", rebuild);
  $("#vr-copy").addEventListener("click", () => copyText($("#vr-output").value, $("#vr-copy")));
  $("#vr-reset").addEventListener("click", reset);
  $("#vr-show-test").addEventListener("change", () => {
    $("#vr-test-panel").classList.toggle("hidden", !$("#vr-show-test").checked);
  });
  $("#vr-test-input").addEventListener("input", rebuildTest);
}

// ── SelectList Direct Render Helper ─────────────────────────────────────────
function renderSelectList(containerSel, blocks, selectedList, filterQuery) {
  const host = $(containerSel);
  if (!host) return;
  const filter = (filterQuery || "").toLowerCase().trim();

  // Filter matching blocks
  const filtered = blocks.filter(b => b.name.toLowerCase().includes(filter));

  if (filtered.length === 0) {
    host.innerHTML = `<div class="empty-state" style="padding:12px;font-size:12px;color:var(--muted)">No modifiers match the filter.</div>`;
    return;
  }

  host.innerHTML = filtered.map(block => {
    const current = selectedList.find(e => e.name === block.name) || { isSelected: false, value: null };
    const activeCls = current.isSelected ? " active-bg" : "";

    const hasRange = block.name.startsWith("##%") && block.ranges && block.ranges.length > 0 && block.ranges[0][0] > 0;
    const displayName = block.name.replace(/\|/g, " • ");

    const placeholder = hasRange ? `${block.ranges[0][0]}-${block.ranges[0][1]}` : "value";

    const cleanName = hasRange 
      ? displayName.replace(/^##%/, "").replace(/##/g, "#") 
      : displayName.replace(/##/g, "#");

    return `
      <div class="vr-select-element${activeCls}" data-id="${block.id}">
        ${hasRange ? `
          <input type="number" class="vr-selected-mod-input vr-select-element-input" data-id="${block.id}" value="${current.value !== null ? current.value : ''}" placeholder="${placeholder}">
        ` : ''}
        <div class="vr-select-element-text" data-id="${block.id}">
          ${cleanName}
        </div>
      </div>
    `;
  }).join("");

  $$(`${containerSel} .vr-select-element-text`).forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const block = blocks.find(b => b.id === id);
      if (!block) return;

      const idx = selectedList.findIndex(e => e.name === block.name);
      if (idx !== -1) {
        selectedList.splice(idx, 1);
      } else {
        selectedList.push({ id: block.id, name: block.name, regex: block.regex, value: null, isSelected: true });
      }
      renderSelectList(containerSel, blocks, selectedList, filterQuery);
      rebuild();
    });
  });

  $$(`${containerSel} .vr-select-element-input`).forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.id;
      const block = blocks.find(b => b.id === id);
      if (!block) return;

      const val = input.value.trim();
      const idx = selectedList.findIndex(e => e.name === block.name);

      if (val) {
        if (idx !== -1) {
          selectedList[idx].value = val;
          selectedList[idx].isSelected = true;
        } else {
          selectedList.push({ id: block.id, name: block.name, regex: block.regex, value: val, isSelected: true });
        }
      } else {
        if (idx !== -1) {
          selectedList.splice(idx, 1);
        }
      }
      rebuild();
    });
  });
}

// ── Render Relics Lists ──────────────────────────────────────────────────────
function renderRelicsLists() {
  renderSelectList("#relic-prefixes-list", RELIC_PREFIXES, state.rlPrefixList);
  renderSelectList("#relic-suffixes-list", RELIC_SUFFIXES, state.rlSuffixList);
}

// ── Reset ──────────────────────────────────────────────────────────────────
function reset() {
  $$(".pane-content input[type='checkbox']").forEach(chk => chk.checked = false);
  $$(".pane-content input[type='number']").forEach(input => input.value = "");

  $("#rl-prefix-filter").value = "";
  $("#rl-suffix-filter").value = "";

  state.rlPrefixList = [];
  state.rlSuffixList = [];

  renderRelicsLists();
  
  $("#vr-custom").value = "";
  rebuild();
}

// ── generateNumberRegex Ranges compiler ──────────────────────────────────────
function generateNumberRegex(numberStr, round10) {
  if (!numberStr) return "";
  const numbers = numberStr.match(/\d/g);
  if (numbers === null) {
    return "";
  }
  const quant = round10
    ? Math.floor(Number(numbers.join("")) / 10) * 10
    : Number(numbers.join(""));
  if (isNaN(quant) || quant === 0) {
    if (round10 && numbers.length === 1) {
      return ".";
    }
    return "";
  }
  if (quant >= 100) {
    return threeDigitMin(quant);
  }
  if (quant > 9) {
    const str = quant.toString();
    const d0 = str[0];
    const d1 = str[1];
    if (str[1] === "0") {
      return `([${d0}-9].|\\d..)`;
    } else if (str[0] === "9") {
      return `(${d0}[${d1}-9]|\\d..)`;
    } else {
      return `(${d0}[${d1}-9]|[${Number(d0) + 1}-9].|\\d..)`;
    }
  }
  if (quant <= 9) {
    return `([${quant}-9]|\\d..?)`;
  }
  return numberStr;
}

function threeDigitMin(n) {
  const str = n.toString();
  const d0 = str[0];
  const d1 = str[1];
  const d2 = str[2];
  const D0 = Number(d0);
  const D1 = Number(d1);
  if (d1 === "0" && d2 === "0") {
    return D0 === 9 ? `${d0}..` : `[${d0}-9]..`;
  }
  let head;
  if (d2 === "0") {
    head = d1 === "9" ? `${d0}9.` : `${d0}[${d1}-9].`;
  } else if (d1 === "0") {
    head = `${d0}(0[${d2}-9]|[1-9].)`;
  } else if (d1 === "9" && d2 === "9") {
    head = `${d0}99`;
  } else if (d1 === "9") {
    head = `${d0}9[${d2}-9]`;
  } else {
    head = `${d0}(${d1}[${d2}-9]|[${D1 + 1}-9].)`;
  }
  return D0 === 9 ? head : `(${head}|[${D0 + 1}-9]..)`;
}

function selectedOptionRegex(option, round10) {
  if (option.value) {
    return `${generateNumberRegex(option.value.toString(), round10)}.*${option.regex}`;
  } else {
    return option.regex;
  }
}

// ── Tab 4: generateRelicResult ──────────────────────────────────────────────
function generateRelicResult() {
  const matchType = $("input[name='rl-match-type']:checked")?.value || "any";

  const prefixes = state.rlPrefixList.map(e => selectedOptionRegex(e, false));
  const suffixes = state.rlSuffixList.map(e => selectedOptionRegex(e, false));
  
  const modifiers = [
    prefixes.join("|"),
    suffixes.join("|")
  ].filter(Boolean);

  if (modifiers.length === 0) return "";

  if (matchType === "any") {
    return `"${modifiers.join("|")}"`;
  } else {
    return modifiers.map(e => `"${e}"`).join(" ");
  }
}

// ── Rebuild Final Regular Expression Output ────────────────────────────────
function rebuild() {
  let customIsRegex = $("#vr-custom-regex").checked;
  let customTerms = parseCustomTerms($("#vr-custom").value, customIsRegex);

  let compiledRegex = generateRelicResult();

  let regex = compiledRegex;
  if (customTerms.length > 0) {
    const customString = customTerms.map(t => `"${t}"`).join(" ");
    if (regex) regex += " " + customString;
    else regex = customString;
  }

  const termsToChunk = parseQuotesIntoTerms(regex);
  const chunks = chunkTerms(termsToChunk, MAX_LENGTH);

  state.lastChunks = chunks;
  $("#vr-output").value = regex;

  const len = regex.length;
  const pct = Math.min(100, (len / MAX_LENGTH) * 100);
  $("#vr-length").textContent = `${len} / ${MAX_LENGTH}`;
  const bar = $("#vr-length-bar");
  bar.style.width = `${pct}%`;
  bar.className = "vr-length-bar" + (pct >= 100 ? " over" : pct >= 80 ? " warn" : "");

  renderWarning(regex, chunks);
  renderChunks(chunks);
  rebuildTest();
}

function parseQuotesIntoTerms(str) {
  if (!str.trim()) return [];
  const regex = /"([^"]+)"/g;
  const terms = [];
  let match;
  while ((match = regex.exec(str)) !== null) {
    terms.push(match[1]);
  }
  if (terms.length === 0) {
    return str.split("|").filter(Boolean);
  }
  return terms;
}

function chunkTerms(terms, maxLen) {
  if (terms.length === 0) return [];
  const chunks = [];
  let currentTerms = [];
  let currentLen = 0;

  for (const term of terms) {
    const termStr = `"${term}"`;
    if (currentLen === 0) {
      currentTerms.push(term);
      currentLen = termStr.length;
    } else if (currentLen + 1 + termStr.length <= maxLen) {
      currentTerms.push(term);
      currentLen += 1 + termStr.length;
    } else {
      chunks.push(currentTerms.map(t => `"${t}"`).join(" "));
      currentTerms = [term];
      currentLen = termStr.length;
    }
  }
  if (currentTerms.length > 0) {
    chunks.push(currentTerms.map(t => `"${t}"`).join(" "));
  }
  return chunks;
}

function renderWarning(regex, chunks) {
  const el = $("#vr-warning");
  if (!regex) { el.classList.add("hidden"); return; }

  for (const chunk of chunks) {
    try {
      const parsed = parseQuotesIntoTerms(chunk);
      parsed.forEach(p => new RegExp(p, "i"));
    } catch (err) {
      el.textContent = `Invalid regex inside compiled query: ${err.message}`;
      el.classList.remove("hidden");
      return;
    }
  }

  if (regex.length > MAX_LENGTH) {
    el.textContent = `Output exceeds ${MAX_LENGTH} character in-game limit — copy the ${chunks.length} individual chunk${chunks.length === 1 ? "" : "s"} below.`;
    el.classList.remove("hidden");
    return;
  }

  el.classList.add("hidden");
}

function renderChunks(chunks) {
  const host = $("#vr-chunks");
  if (!chunks.length || (chunks.length === 1 && chunks[0].length <= MAX_LENGTH)) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = chunks.map((chunk, i) => `
    <div class="regex-chunk">
      <div>
        <div class="regex-chunk-meta">Chunk ${i + 1} — ${chunk.length} chars</div>
        <code>${escapeHtml(chunk)}</code>
      </div>
      <button type="button" class="ghost sm" data-copy-chunk="${i}">Copy</button>
    </div>
  `).join("");

  $$("#vr-chunks [data-copy-chunk]").forEach((btn) => {
    btn.addEventListener("click", () => copyText(chunks[Number(btn.dataset.copyChunk)] || "", btn));
  });
}

function rebuildTest() {
  const result = $("#vr-test-result");
  const regexText = $("#vr-output").value;
  const testText = $("#vr-test-input").value;
  if (!testText.trim()) { result.textContent = "No test text."; return; }
  if (!regexText) { result.textContent = "No regex selected."; return; }

  const terms = parseQuotesIntoTerms(regexText);
  if (terms.length === 0) { result.textContent = "No query matching terms compiled."; return; }

  let regExps = [];
  try {
    regExps = terms.map(t => new RegExp(t, "i"));
  } catch {
    result.textContent = "Invalid regex compilation.";
    return;
  }

  const lines = testText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const matches = lines.filter(line => {
    return regExps.every(rx => rx.test(line));
  });

  if (!matches.length) { result.textContent = "0 matching lines."; return; }

  result.innerHTML = `
    <div class="regex-test-count">${matches.length} matching line${matches.length === 1 ? "" : "s"} (AND gate query)</div>
    ${matches.map((l) => `<div class="regex-test-line">${escapeHtml(l)}</div>`).join("")}
  `;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function parseCustomTerms(value, isRegex) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const splitPattern = isRegex ? /[\n,]+/ : /[\n,|]+/;
  return trimmed
    .split(splitPattern)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (isRegex ? t : escapeRegex(t)));
}

async function copyText(text, btn) {
  if (!text) return;
  const prev = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  btn.textContent = "Copied!";
  setTimeout(() => { btn.textContent = prev; }, 1200);
}

function escapeRegex(v) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", init);
