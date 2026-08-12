/** Categorías de avatar, de más común a más exclusiva. */
export const CATEGORIES = [
  'Basic',
  'Rare',
  'Epic',
  'Legendary',
  'Hidden',
  'Unique',
  'Limited',
  'Whalegrade',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Equivalencias con el campo `rarity` anterior, usadas por la migración.
 * Todo lo que no encaje pasa a 'Basic'.
 */
export const RARITY_TO_CATEGORY: Record<string, Category> = {
  comun: 'Basic',
  raro: 'Rare',
  epico: 'Epic',
  legendario: 'Legendary',
  legend: 'Legendary',
};

/** Tipos de sprite de un avatar. `front` y `back` son obligatorios. */
export const SPRITE_TYPES = ['front', 'back', 'default', 'win', 'lose'] as const;
export type SpriteType = (typeof SPRITE_TYPES)[number];

export const REQUIRED_SPRITE_TYPES: SpriteType[] = ['front', 'back'];

/** Etiquetas en español para el panel. */
export const SPRITE_LABELS: Record<SpriteType, string> = {
  front: 'Frente',
  back: 'Espalda',
  default: 'Reposo',
  win: 'Victoria',
  lose: 'Derrota',
};
