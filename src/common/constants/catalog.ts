/**
 * Categorías de avatar, de más común a más exclusiva.
 *
 * `Enemy` es aparte: no es un escalón de rareza sino una marca de que el avatar
 * pertenece al sistema. Nunca se lista en la tienda, no se compra y no se puede
 * equipar; sólo la campaña los saca a pelear.
 */
export const CATEGORIES = [
  'Basic',
  'Rare',
  'Epic',
  'Legendary',
  'Hidden',
  'Unique',
  'Limited',
  'Whalegrade',
  'Enemy',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** La categoría que marca a un avatar como criatura del sistema. */
export const ENEMY_CATEGORY = 'Enemy' satisfies Category;

/** Categorías que un jugador puede llegar a tener en su colección. */
export const PLAYABLE_CATEGORIES = CATEGORIES.filter(
  (c) => c !== ENEMY_CATEGORY,
);

/** Un avatar de enemigo no es jugable bajo ninguna circunstancia. */
export function isEnemyCategory(category?: string | null): boolean {
  return category === ENEMY_CATEGORY;
}

/**
 * Clase de un enemigo dentro de la campaña. Marca su papel en el ciclo de
 * niveles y de ella dependen los corazones, el premio y la astucia.
 */
export const ENEMY_CLASSES = ['Basic', 'Elite', 'Boss'] as const;
export type EnemyClass = (typeof ENEMY_CLASSES)[number];

export const ENEMY_CLASS_LABELS: Record<EnemyClass, string> = {
  Basic: 'Común',
  Elite: 'Élite',
  Boss: 'Jefe',
};

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
export const SPRITE_TYPES = [
  'front',
  'back',
  'default',
  'win',
  'lose',
] as const;
export type SpriteType = (typeof SPRITE_TYPES)[number];

export const REQUIRED_SPRITE_TYPES: SpriteType[] = ['front', 'back'];

/**
 * A un enemigo sólo se le exige el frente: siempre se le ve de cara al jugador,
 * nunca de espaldas, así que pedirle la imagen trasera sería trabajo tirado.
 */
export const REQUIRED_ENEMY_SPRITE_TYPES: SpriteType[] = ['front'];

/** Etiquetas en español para el panel. */
export const SPRITE_LABELS: Record<SpriteType, string> = {
  front: 'Frente',
  back: 'Espalda',
  default: 'Reposo',
  win: 'Victoria',
  lose: 'Derrota',
};
