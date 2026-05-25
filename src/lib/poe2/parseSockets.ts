import { SOCKETS_RE, RUNE_RE, SOUL_CORE_RE } from './regex.ts';

export type ParsedSockets = {
  runes: string[];
  soulCores: string[];
  sockets?: string;
};

export function parseSockets(
  lines: string[],
  unknownLines: string[]
): ParsedSockets {
  const result: ParsedSockets = {
    runes: [],
    soulCores: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matched = false;

    // Sockets
    const socketsMatch = trimmed.match(SOCKETS_RE);
    if (socketsMatch) {
      result.sockets = socketsMatch[1].trim();
      matched = true;
      continue;
    }

    // Rune
    const runeMatch = trimmed.match(RUNE_RE);
    if (runeMatch) {
      result.runes.push(runeMatch[1].trim());
      matched = true;
      continue;
    }

    // Soul Core
    const soulCoreMatch = trimmed.match(SOUL_CORE_RE);
    if (soulCoreMatch) {
      result.soulCores.push(soulCoreMatch[1].trim());
      matched = true;
      continue;
    }

    if (!matched) {
      unknownLines.push(`unknown socket format: ${trimmed}`);
    }
  }

  return result;
}
