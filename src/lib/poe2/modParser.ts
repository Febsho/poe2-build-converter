import {
  FLAT_STAT_RE,
  PERCENT_STAT_RE,
  INCREASED_RE,
  REDUCED_RE,
  ADDS_DAMAGE_RE,
  NUMBER_VALUE_RE,
  ESSENCE_MOD_RE,
  CRAFTED_MOD_RE,
  RUNE_MOD_RE,
  SOUL_CORE_MOD_RE,
} from './regex.ts';

export type ParsedModifier = {
  raw: string;
  kind:
    | 'flat'
    | 'percent'
    | 'increased'
    | 'reduced'
    | 'added_damage'
    | 'rune'
    | 'soul_core'
    | 'crafted'
    | 'essence'
    | 'unknown';
  values: number[];
};

export function parseModifier(line: string): ParsedModifier {
  const raw = line.trim();

  // Extract all numeric values
  const numMatches = raw.match(NUMBER_VALUE_RE);
  const values = numMatches ? numMatches.map(Number) : [];

  // Classify mod kind
  let kind: ParsedModifier['kind'] = 'unknown';

  if (ESSENCE_MOD_RE.test(raw)) {
    kind = 'essence';
  } else if (CRAFTED_MOD_RE.test(raw)) {
    kind = 'crafted';
  } else if (RUNE_MOD_RE.test(raw)) {
    kind = 'rune';
  } else if (SOUL_CORE_MOD_RE.test(raw)) {
    kind = 'soul_core';
  } else if (ADDS_DAMAGE_RE.test(raw)) {
    kind = 'added_damage';
  } else if (INCREASED_RE.test(raw)) {
    kind = 'increased';
  } else if (REDUCED_RE.test(raw)) {
    kind = 'reduced';
  } else if (PERCENT_STAT_RE.test(raw)) {
    kind = 'percent';
  } else if (FLAT_STAT_RE.test(raw)) {
    kind = 'flat';
  }

  return {
    raw,
    kind,
    values,
  };
}
