// Path of Exile 2 Regex Constants

export const ITEM_CLASS_RE = /^Item Class:\s*(.+)$/i;
export const RARITY_RE = /^Rarity:\s*(Normal|Magic|Rare|Unique)$/i;
export const ITEM_LEVEL_RE = /^Item Level:\s*(\d+)$/i;
export const SEPARATOR_RE = /^-+$/;

export const REQUIRES_LEVEL_RE = /Requires(?:\s+Level)?\s+(\d+)/i;
export const REQUIRES_STR_RE = /(\d+)\s+Str/i;
export const REQUIRES_DEX_RE = /(\d+)\s+Dex/i;
export const REQUIRES_INT_RE = /(\d+)\s+Int/i;

export const QUALITY_RE = /^Quality:\s*\+?(\d+)%/i;

export const ARMOUR_RE = /^Armour:\s*(\d+)/i;
export const EVASION_RE = /^Evasion Rating:\s*(\d+)/i;
export const ENERGY_SHIELD_RE = /^Energy Shield:\s*(\d+)/i;
export const BLOCK_CHANCE_RE = /^Block chance:\s*([\d.]+)%/i;

export const PHYSICAL_DAMAGE_RE = /^Physical Damage:\s*(\d+)-(\d+)/i;
export const ELEMENTAL_DAMAGE_RE = /^Elemental Damage:\s*(.+)$/i;
export const CRIT_CHANCE_RE = /^Critical Hit Chance:\s*([\d.]+)%/i;
export const ATTACKS_PER_SECOND_RE = /^Attacks per Second:\s*([\d.]+)/i;

export const SOCKETS_RE = /^Sockets?:\s*(.+)$/i;
export const RUNE_RE = /^(?:Rune|Socketed Rune):\s*(.+)$/i;
export const SOUL_CORE_RE = /^(?:Soul Core|Socketed Soul Core):\s*(.+)$/i;

export const CORRUPTED_RE = /^Corrupted$/i;
export const MIRRORED_RE = /^Mirrored$/i;
export const UNIDENTIFIED_RE = /^Unidentified$/i;

export const FLAT_STAT_RE = /^\+?(\d+)\s+to\s+(.+)$/i;
export const PERCENT_STAT_RE = /^\+?(\d+(?:\.\d+)?)%\s+(.+)$/i;
export const INCREASED_RE = /^(\d+(?:\.\d+)?)%\s+increased\s+(.+)$/i;
export const REDUCED_RE = /^(\d+(?:\.\d+)?)%\s+reduced\s+(.+)$/i;
export const ADDS_DAMAGE_RE = /^Adds\s+(\d+)\s+to\s+(\d+)\s+(.+?)\s+Damage$/i;

export const NUMBER_VALUE_RE = /[+-]?\d+(?:\.\d+)?/g;
export const RANGE_VALUE_RE = /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)/i;

export const ESSENCE_MOD_RE = /\bEssence\b/i;
export const CRAFTED_MOD_RE = /\bCrafted\b/i;
export const RUNE_MOD_RE = /\bRune\b/i;
export const SOUL_CORE_MOD_RE = /\bSoul Core\b/i;
