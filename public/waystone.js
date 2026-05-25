"use strict";

const MAX_LENGTH = 250;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  mode: "waystone",
  waystoneAffixes: [],
  wsWantedList: [],
  wsUnwantedList: [],
  lastChunks: [],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ── Initialization ─────────────────────────────────────────────────────────
function init() {
  bindEvents();
  loadGeneratedData();
  rebuild();
}

function bindEvents() {
  // Waystone event bindings
  const wsSelectors = [
    "#ws-round10", "#ws-iiq", "#ws-iir", "#ws-drop", "#ws-magics", "#ws-rares",
    "#ws-state-corr", "#ws-state-uncorr", "#ws-state-delirious"
  ];
  wsSelectors.forEach(sel => {
    const el = $(sel);
    if (el) el.addEventListener("input", rebuild);
  });

  const wsMinEl = $("#ws-tier-min");
  const wsMaxEl = $("#ws-tier-max");
  if (wsMinEl && wsMaxEl) {
    const clampTiers = () => {
      let minVal = Math.max(1, Math.min(16, Number(wsMinEl.value) || 1));
      let maxVal = Math.max(1, Math.min(16, Number(wsMaxEl.value) || 16));
      if (minVal > maxVal) {
        minVal = maxVal;
      }
      wsMinEl.value = minVal;
      wsMaxEl.value = maxVal;
      rebuild();
    };
    wsMinEl.addEventListener("input", clampTiers);
    wsMaxEl.addEventListener("input", clampTiers);
    wsMinEl.addEventListener("change", clampTiers);
    wsMaxEl.addEventListener("change", clampTiers);
  }
  $$("input[name='ws-wanted-type']").forEach(el => el.addEventListener("change", rebuild));

  // Waystone mod filter bindings
  $("#ws-wanted-filter").addEventListener("input", (e) => {
    renderSelectList("#ws-wanted-list", state.waystoneAffixes, state.wsWantedList, e.target.value);
  });
  $("#ws-unwanted-filter").addEventListener("input", (e) => {
    renderSelectList("#ws-unwanted-list", state.waystoneAffixes, state.wsUnwantedList, e.target.value);
  });

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

// ── Reset ──────────────────────────────────────────────────────────────────
function reset() {
  $$(".pane-content input[type='checkbox']").forEach(chk => chk.checked = false);
  $$(".pane-content input[type='number']").forEach(input => input.value = "");
  $("#ws-round10").checked = true;
  $("#ws-tier-min").value = "1";
  $("#ws-tier-max").value = "16";

  $("#ws-wanted-filter").value = "";
  $("#ws-unwanted-filter").value = "";

  state.wsWantedList = [];
  state.wsUnwantedList = [];

  renderSelectList("#ws-wanted-list", state.waystoneAffixes, state.wsWantedList);
  renderSelectList("#ws-unwanted-list", state.waystoneAffixes, state.wsUnwantedList);
  
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

// ── generateWaystoneRegex ────────────────────────────────────────────
function generateWaystoneRegex() {
  const round10 = $("#ws-round10").checked;
  const wantedType = $("input[name='ws-wanted-type']:checked")?.value || "any";

  const tierMax = Math.max(1, Math.min(16, Number($("#ws-tier-max").value) || 16));
  const tierMin = Math.max(1, Math.min(tierMax, Number($("#ws-tier-min").value) || 1));
  const tierRegex = generateTierRegex(tierMin, tierMax);

  // States
  const delirious = $("#ws-state-delirious").checked ? "delir" : null;
  const corrupted = $("#ws-state-corr").checked && !$("#ws-state-uncorr").checked ? "corr"
    : !$("#ws-state-corr").checked && $("#ws-state-uncorr").checked ? "!corr"
    : null;
  const stateRegex = [delirious, corrupted].filter(Boolean).join(" ");

  // Quantifiers
  const quantifiers = [
    addQuantifier("m q.*", generateNumberRegex($("#ws-iiq").value, round10)),
    addQuantifier("m rar.*", generateNumberRegex($("#ws-iir").value, round10)),
    addQuantifier("p c.*", generateNumberRegex($("#ws-drop").value, round10)),
    addQuantifier("c m.*", generateNumberRegex($("#ws-magics").value, round10)),
    addQuantifier("e mo.*", generateNumberRegex($("#ws-rares").value, round10)),
  ].filter(Boolean).join(" ");

  // Mods
  const wanted = state.wsWantedList.map(e => selectedOptionRegex(e, round10));
  const wantedModsRegex = wanted.length > 0 
    ? (wantedType === "any" ? `"${wanted.join("|")}"` : wanted.map(e => `"${e}"`).join(" "))
    : "";

  const unwanted = state.wsUnwantedList.map(e => selectedOptionRegex(e, round10));
  const unwantedModsRegex = unwanted.length > 0 ? `"!${unwanted.join("|")}"` : "";

  const result = [
    tierRegex,
    wantedModsRegex || null,
    unwantedModsRegex || null,
    stateRegex || null,
    quantifiers || null
  ].filter(Boolean);

  return result.length > 0 ? result.join(" ").trim() : "";
}

function addQuantifier(prefix, valueRegex) {
  return valueRegex ? `"${prefix}${valueRegex}%"` : "";
}

function generateTierRegex(min, max) {
  if (max === 0 && min === 0) return null;
  if (max !== 0 && min > max) return null;
  if (min < 1 || max < 1) return null;
  if (min <= 1 && max === 16) return null;

  const numbersUnder10 = [];
  for (let i = min; i <= Math.min(9, max); i++) numbersUnder10.push(i);

  const numbersOver10 = [];
  for (let i = Math.max(10, min); i <= Math.min(16, max); i++) numbersOver10.push(i);

  let regexUnder10 = "";
  if (numbersUnder10.length === 1) regexUnder10 = `${numbersUnder10[0]}`;
  else if (numbersUnder10.length === 2) regexUnder10 = `[${numbersUnder10.join("")}]`;
  else if (numbersUnder10.length > 2) regexUnder10 = `[${numbersUnder10[0]}-${numbersUnder10[numbersUnder10.length - 1]}]`;

  let regexOver10 = "";
  if (numbersOver10.length === 1) regexOver10 = `${numbersOver10[0]}`;
  else if (numbersOver10.length > 1) regexOver10 = `1[${numbersOver10.map(n => n.toString()[1]).join("")}]`;

  const under10 = regexUnder10 === "" ? "" : `r ${regexUnder10}\\)`;
  const over10 = regexOver10 === "" ? "" : `${regexOver10}\\)`;
  const result = [under10, over10].filter(e => e !== "").join("|");
  return result === "" ? "" : `"${result}"`;
}

// ── Rebuild Final Regular Expression Output ────────────────────────────────
function rebuild() {
  let customIsRegex = $("#vr-custom-regex").checked;
  let customTerms = parseCustomTerms($("#vr-custom").value, customIsRegex);

  let compiledRegex = generateWaystoneRegex();

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

// ── Fetch dynamic waystones data from local JSON or API fallback ──
function parseToken(token, idPrefix) {
  const ranges = [];
  const values = [];

  const rawText = token.rawText || token.label || "";
  const lines = rawText.split("\n");
  const processed = lines.map((line) => {
    let out = line;
    out = out.replace(/\(([+-]?\d+)-([+-]?\d+)\)/g, (_match, a, b) => {
      ranges.push([Number(a), Number(b)]);
      return "##";
    });
    out = out.replace(/(?<![A-Za-z0-9])\+?(\d+)(?![A-Za-z0-9])/g, (_match, n) => {
      values.push(Number(n));
      return "#";
    });
    out = out.replace(/\[([^\]]+)\]/g, "$1");
    return out;
  });

  const name = processed.join(" | ");
  const shortLabel = name.length > 50 ? name.slice(0, 48) + "..." : name;

  return {
    id: String(token.id || idPrefix + "-" + Math.random()),
    label: name,
    shortLabel: shortLabel,
    name: name,
    regex: token.regex,
    terms: [token.regex],
    values,
    ranges
  };
}

async function loadGeneratedData() {
  try {
    const res = await fetch(`/generated/Generated.Waystone.json?t=${Math.floor(Date.now() / 3600000)}`);
    if (!res.ok) {
      const apiRes = await fetch(`/api/regex-data/waystone?t=${Math.floor(Date.now() / 3600000)}`);
      if (!apiRes.ok) return;
      const data = await apiRes.json();
      state.waystoneAffixes = Array.isArray(data.blocks) ? data.blocks.map(b => parseToken(b, "waystone")) : [];
    } else {
      const data = await res.json();
      const tokens = Array.isArray(data.tokens) ? data.tokens : [];
      state.waystoneAffixes = tokens.map((t, idx) => parseToken(t, "waystone-" + idx));
    }
    state.waystoneAffixes.sort((a, b) => a.name.localeCompare(b.name));
    renderSelectList("#ws-wanted-list", state.waystoneAffixes, state.wsWantedList);
    renderSelectList("#ws-unwanted-list", state.waystoneAffixes, state.wsUnwantedList);
  } catch (e) {
    console.warn("Failed to load waystones data:", e);
  }
}

document.addEventListener("DOMContentLoaded", init);
