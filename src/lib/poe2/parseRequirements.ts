import {
  REQUIRES_LEVEL_RE,
  REQUIRES_STR_RE,
  REQUIRES_DEX_RE,
  REQUIRES_INT_RE,
} from './regex.ts';

export type ParsedRequirements = {
  level?: number;
  str?: number;
  dex?: number;
  int?: number;
};

export function parseRequirements(
  lines: string[],
  unknownLines: string[]
): ParsedRequirements {
  const requirements: ParsedRequirements = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip the "Requirements:" header line if it exists
    if (/^Requirements:?$/i.test(trimmed)) {
      continue;
    }

    let matchedAny = false;

    const levelMatch = trimmed.match(REQUIRES_LEVEL_RE);
    if (levelMatch) {
      requirements.level = parseInt(levelMatch[1], 10);
      matchedAny = true;
    }

    const strMatch = trimmed.match(REQUIRES_STR_RE);
    if (strMatch) {
      requirements.str = parseInt(strMatch[1], 10);
      matchedAny = true;
    }

    const dexMatch = trimmed.match(REQUIRES_DEX_RE);
    if (dexMatch) {
      requirements.dex = parseInt(dexMatch[1], 10);
      matchedAny = true;
    }

    const intMatch = trimmed.match(REQUIRES_INT_RE);
    if (intMatch) {
      requirements.int = parseInt(intMatch[1], 10);
      matchedAny = true;
    }

    if (!matchedAny) {
      unknownLines.push(`unknown requirement format: ${trimmed}`);
    }
  }

  return requirements;
}
