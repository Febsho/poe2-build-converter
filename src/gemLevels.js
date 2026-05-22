const ROMAN_LEVELS = new Map([
  ['I', 1],
  ['II', 2],
  ['III', 3],
  ['IV', 4],
  ['V', 5],
  ['VI', 6],
]);

export function resolveGemLevel(explicitLevel, ...nameCandidates) {
  let preferNameSuffix = false;
  if (typeof nameCandidates[nameCandidates.length - 1] === 'object' && nameCandidates[nameCandidates.length - 1] !== null) {
    const options = nameCandidates.pop();
    preferNameSuffix = !!options.preferNameSuffix;
  }

  const numericLevel = Number(explicitLevel);
  if (preferNameSuffix) {
    for (const candidate of nameCandidates) {
      const inferred = inferGemLevelFromName(candidate);
      if (inferred > 1) {
        return inferred;
      }
    }
  }

  if (Number.isFinite(numericLevel) && numericLevel > 1) {
    return numericLevel;
  }

  for (const candidate of nameCandidates) {
    const inferred = inferGemLevelFromName(candidate);
    if (inferred > 1) {
      return inferred;
    }
  }

  if (Number.isFinite(numericLevel) && numericLevel > 0) {
    return numericLevel;
  }
  return 1;
}

export function inferGemLevelFromName(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;

  const numericMatch = text.match(/\b(\d+)\s*$/);
  if (numericMatch) {
    return Number(numericMatch[1]) || 0;
  }

  const romanMatch = text.match(/\b([IVX]+)\s*$/i);
  if (!romanMatch) return 0;
  return ROMAN_LEVELS.get(romanMatch[1].toUpperCase()) ?? 0;
}
