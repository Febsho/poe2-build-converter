"use strict";

const MAX_LENGTH = 250;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  mode: "item",
  lastChunks: [],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ── Initialization ─────────────────────────────────────────────────────────
function init() {
  bindEvents();
  rebuild();
}

function bindEvents() {
  // Re-run builder on checkbox / input change for Item/Vendor tab
  const vendorSelectors = [
    "#item-prop-quality", "#item-prop-sockets", "#item-speed-attack", "#item-speed-cast",
    "#item-move-30", "#item-move-25", "#item-move-20", "#item-move-15", "#item-move-10",
    "#item-res-fire", "#item-res-cold", "#item-res-lightning", "#item-res-chaos",
    "#item-level-min", "#item-level-max", "#item-char-min", "#item-char-max",
    "#item-rarity-rare", "#item-rarity-magic", "#item-rarity-normal",
    "#item-mod-phys", "#item-mod-spell", "#item-mod-elem", "#item-mod-cold", "#item-mod-fire",
    "#item-mod-lightning", "#item-mod-chaos", "#item-mod-spirit", "#item-mod-rarity",
    "#item-mod-life", "#item-mod-mana",
    "#item-mod-skill-all", "#item-mod-skill-minion", "#item-mod-skill-melee",
    "#item-mod-skill-spell", "#item-mod-skill-fire", "#item-mod-skill-cold",
    "#item-mod-skill-lightning", "#item-mod-skill-projectile",
    "#item-attr-str", "#item-attr-int", "#item-attr-dex",
    "#item-class-amulet", "#item-class-ring", "#item-class-belt", "#item-class-wand",
    "#item-class-mace1", "#item-class-sceptre", "#item-class-bow", "#item-class-staff",
    "#item-class-mace2", "#item-class-qstaff", "#item-class-spear", "#item-class-xbow",
    "#item-class-talisman", "#item-class-gloves", "#item-class-boots", "#item-class-body",
    "#item-class-helmet", "#item-class-quiver", "#item-class-focus", "#item-class-shield"
  ];
  vendorSelectors.forEach(sel => {
    const el = $(sel);
    if (el) el.addEventListener("input", rebuild);
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

// ── Reset ──────────────────────────────────────────────────────────────────
function reset() {
  // Clear Item checkboxes
  $$(".pane-content input[type='checkbox']").forEach(chk => chk.checked = false);
  $$(".pane-content input[type='number']").forEach(input => input.value = "");

  $("#vr-custom").value = "";
  rebuild();
}

// ── Tab 1: generateVendorRegex ──────────────────────────────────────────────
function generateVendorRegex() {
  const terms = [];

  // 1. Property
  if ($("#item-prop-quality").checked) terms.push("y: \\+");
  if ($("#item-prop-sockets").checked) terms.push("ts: S");

  // 2. Item Rarity (Type)
  const types = [];
  if ($("#item-rarity-rare").checked) types.push("r");
  if ($("#item-rarity-magic").checked) types.push("m");
  if ($("#item-rarity-normal").checked) types.push("n");
  if (types.length > 0 && types.length < 3) {
    if (types.length > 1) terms.push(`y: (${types.join("|")})`);
    else terms.push(`y: ${types[0]}`);
  }

  // 3. Level ranges
  const lvMin = Number($("#item-level-min").value) || 0;
  const lvMax = Number($("#item-level-max").value) || 0;
  const itemLevelRegex = createLevelRangeRegex(lvMin, lvMax, "m level: ");
  if (itemLevelRegex) terms.push(itemLevelRegex);

  const chMin = Number($("#item-char-min").value) || 0;
  const chMax = Number($("#item-char-max").value) || 0;
  const charLevelRegex = createLevelRangeRegex(chMin, chMax, "s: level ");
  if (charLevelRegex) terms.push(charLevelRegex);

  // 4. Resistances
  const res = [];
  if ($("#item-res-fire").checked) res.push("fi");
  if ($("#item-res-cold").checked) res.push("co");
  if ($("#item-res-lightning").checked) res.push("li");
  if ($("#item-res-chaos").checked) res.push("ch");
  if (res.length > 0) {
    if (res.length === 4) terms.push("resi");
    else if (res.length > 1) terms.push(`(${res.join("|")}).+res`);
    else terms.push(`${res[0]}.+res`);
  }

  // 5. Movement speed
  const move0 = [];
  if ($("#item-move-30").checked) move0.push("30");
  if ($("#item-move-20").checked) move0.push("20");
  if ($("#item-move-10").checked) move0.push("10");

  const move5 = [];
  if ($("#item-move-25").checked) move5.push("25");
  if ($("#item-move-15").checked) move5.push("15");

  const numOfSelected = move0.length + move5.length;
  if (numOfSelected > 0) {
    if (numOfSelected === 1) {
      terms.push(`${[...move0, ...move5].join("")}% i.+mov`);
    } else if (numOfSelected === 5) {
      terms.push("\\d+% i.+mov");
    } else {
      const zeros = move0.length > 1 ? `[${move0.map(e => e[0]).join("")}]0` : move0.join("|");
      const fives = move5.length > 1 ? `[${move5.map(e => e[0]).join("")}]5` : move5.join("|");
      terms.push(`(${[zeros, fives].filter(Boolean).join("|")})% i.+mov`);
    }
  }

  // 6. Item modifiers
  const eleDamageList = [];
  if ($("#item-mod-cold").checked) eleDamageList.push("co");
  if ($("#item-mod-chaos").checked) eleDamageList.push("ch");
  if ($("#item-mod-fire").checked) eleDamageList.push("f");
  if ($("#item-mod-lightning").checked) eleDamageList.push("l");

  let eleString = "";
  if ($("#item-mod-elem").checked) {
    eleString = "cfl";
  } else if (eleDamageList.length > 0) {
    eleString = eleDamageList.length > 1 ? `(${eleDamageList.join("|")})` : eleDamageList[0];
  }

  const attributesList = [];
  if ($("#item-attr-str").checked) attributesList.push("str");
  if ($("#item-attr-dex").checked) attributesList.push("d");
  if ($("#item-attr-int").checked) attributesList.push("int");
  const attributes = attributesList.length > 0 ? `o (all a|${attributesList.join("|")})` : null;

  if ($("#item-mod-phys").checked) terms.push("ph.*da");
  if ($("#item-mod-spell").checked) terms.push("ell.*ge$");
  if (eleString) terms.push(`\\d ${eleString}.+da`);
  if ($("#item-mod-skill-all").checked) terms.push("^\\+.*ills$");
  if ($("#item-mod-skill-minion").checked) terms.push("^\\+.*ion skills$");
  if ($("#item-mod-skill-melee").checked) terms.push("^\\+.*ee skills$");
  if ($("#item-mod-skill-spell").checked) terms.push("^\\+.*l s.*ls$");
  if ($("#item-mod-skill-fire").checked) terms.push("^\\+.*re s.*ls$");
  if ($("#item-mod-skill-cold").checked) terms.push("^\\+.*ld s.*ls$");
  if ($("#item-mod-skill-lightning").checked) terms.push("^\\+.*ng s.*ls$");
  if ($("#item-mod-skill-projectile").checked) terms.push("^\\+.*ile skills$");
  if ($("#item-mod-spirit").checked) terms.push("spiri");
  if ($("#item-mod-rarity").checked) terms.push("d rari");
  if ($("#item-speed-attack").checked) terms.push("ck spe");
  if ($("#item-speed-cast").checked) terms.push("st spe");
  if ($("#item-mod-life").checked) terms.push("\\d.+life");
  if ($("#item-mod-mana").checked) terms.push("\\d.+mana");
  if (attributes) terms.push(attributes);

  // 7. Classes
  const itemClasses = [];
  if ($("#item-class-amulet").checked) itemClasses.push("am");
  if ($("#item-class-ring").checked) itemClasses.push("ri");
  if ($("#item-class-belt").checked) itemClasses.push("be");
  if ($("#item-class-wand").checked) itemClasses.push("wa");
  if ($("#item-class-mace1").checked) itemClasses.push("on");
  if ($("#item-class-sceptre").checked) itemClasses.push("sc");
  if ($("#item-class-bow").checked) itemClasses.push("bow");
  if ($("#item-class-staff").checked) itemClasses.push("st");
  if ($("#item-class-mace2").checked) itemClasses.push("tw");
  if ($("#item-class-qstaff").checked) itemClasses.push("qua");
  if ($("#item-class-spear").checked) itemClasses.push("spe");
  if ($("#item-class-xbow").checked) itemClasses.push("cr");
  if ($("#item-class-talisman").checked) itemClasses.push("tali");
  if ($("#item-class-gloves").checked) itemClasses.push("gl");
  if ($("#item-class-boots").checked) itemClasses.push("boo");
  if ($("#item-class-body").checked) itemClasses.push("bod");
  if ($("#item-class-helmet").checked) itemClasses.push("he");
  if ($("#item-class-quiver").checked) itemClasses.push("qui");
  if ($("#item-class-focus").checked) itemClasses.push("fo");
  if ($("#item-class-shield").checked) itemClasses.push("sh");
  if (itemClasses.length > 0) {
    if (itemClasses.length === 1) terms.push(`s: ${itemClasses[0]}`);
    else terms.push(`s: (${itemClasses.join("|")})`);
  }

  return terms.length > 0 ? `"${terms.join("|")}"` : "";
}

// ── Rebuild Final Regular Expression Output ────────────────────────────────
function rebuild() {
  let customIsRegex = $("#vr-custom-regex").checked;
  let customTerms = parseCustomTerms($("#vr-custom").value, customIsRegex);

  let compiledRegex = generateVendorRegex();

  // Combine custom terms.
  let regex = compiledRegex;
  if (customTerms.length > 0) {
    const customString = customTerms.map(t => `"${t}"`).join(" ");
    if (regex) regex += " " + customString;
    else regex = customString;
  }

  // Chop expressions into standard chunks if it exceeds 250 character limit
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

  // Validate regex syntax inside each chunk
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

function dedupeTerms(terms) {
  const seen = new Set();
  return terms.filter((t) => {
    const key = t.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function createLevelRangeRegex(min, max, prefix) {
  if (min === 0 && max === 0) return null;
  if (max > 0 && min > max) return null;
  const effectiveMax = max === 0 ? 99 : max;

  if (min === 0 && effectiveMax === 99) {
    return `${prefix}(\\d{1,2})\\b`;
  }
  if (min > 0 && min === effectiveMax) {
    return `${prefix}(${min})\\b`;
  }

  const singleDigits = min <= 9 ? rangePattern(min, Math.min(9, effectiveMax)) : "";
  const tens = Math.floor(Math.max(min, 10) / 10);
  const maxTens = Math.floor(effectiveMax / 10);
  const patterns = [];

  if (singleDigits) patterns.push(singleDigits);

  if (tens <= maxTens) {
    if (tens === maxTens) {
      const minOnes = min > 9 ? min % 10 : 0;
      const maxOnes = effectiveMax % 10;
      patterns.push(`${tens}[${minOnes}-${maxOnes}]`);
    } else {
      if (min <= tens * 10 + 9 && min > tens * 10) {
        const minOnes = min % 10;
        patterns.push(`${tens}[${minOnes}-9]`);
      } else if (min <= tens * 10) {
        patterns.push(`${tens}\\d`);
      }
      
      if (maxTens > tens + 1) {
        patterns.push(`[${tens + 1}-${maxTens - 1}]\\d`);
      }
      
      if (effectiveMax % 10 > 0) {
        patterns.push(`${maxTens}[0-${effectiveMax % 10}]`);
      } else {
        patterns.push(`${maxTens}0`);
      }
    }
  }

  return `${prefix}(${patterns.join("|")})\\b`;
}

function rangePattern(start, end) {
  if (start > end) return "";
  if (start === end) return start.toString();
  if (start === 0 && end === 9) return "\\d";
  return `[${start}-${end}]`;
}

document.addEventListener("DOMContentLoaded", init);
