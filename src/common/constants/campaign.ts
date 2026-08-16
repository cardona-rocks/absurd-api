import type { EnemyClass } from './catalog';

/**
 * A.b.s.u.r.d. — modo campaña.
 *
 * La campaña no tiene final: los niveles se agrupan en ciclos de 20 que se
 * repiten para siempre. El nivel 1 y el 21 ocupan la misma ranura del ciclo, y
 * por tanto plantean el mismo tipo de combate; lo que cambia es el bestiario,
 * porque los enemigos se eligen por cercanía al nivel absoluto.
 */

/** Niveles que dura una vuelta completa. */
export const CYCLE_LENGTH = 20;

/** Tipos de combate que puede plantear una ranura del ciclo. */
export const LEVEL_KINDS = ['basic', 'gauntlet', 'elite', 'boss'] as const;
export type LevelKind = (typeof LEVEL_KINDS)[number];

export const LEVEL_KIND_LABELS: Record<LevelKind, string> = {
  basic: 'Normal',
  gauntlet: 'Gauntlet',
  elite: 'Élite',
  boss: 'Jefe',
};

/** Corazones del jugador en un nivel corriente. */
export const PLAYER_HEARTS = 3;

export interface CycleSlotSpec {
  /** Posición dentro del ciclo, de 1 a 20. */
  slot: number;
  name: string;
  kind: LevelKind;
  enemyClass: EnemyClass;
  /** Cuántos enemigos hay que tumbar, uno detrás de otro. */
  enemyCount: number;
  /** Corazones de cada enemigo, en orden de aparición. */
  heartsPerEnemy: number[];
  /** Variante para los ciclos pares. Vacía repite la de arriba. */
  heartsPerEnemyAlt: number[];
  playerHearts: number;
}

/** Qué tipo de combate plantea cada ranura del ciclo. */
export function kindForSlot(slot: number): LevelKind {
  if (slot === 20) return 'boss';
  if (slot === 10) return 'elite';
  if (slot === 6 || slot === 16) return 'gauntlet';
  return 'basic';
}

export function enemyClassForKind(kind: LevelKind): EnemyClass {
  return kind === 'boss' ? 'Boss' : kind === 'elite' ? 'Elite' : 'Basic';
}

/**
 * Corazones de cada enemigo en una ranura, para un ciclo dado.
 *
 * El diseño pide "4 o 5" corazones para la élite y "6 o 7" para el jefe. Esa
 * horquilla se reparte por ciclos en vez de al azar: los ciclos impares sacan
 * el mínimo y los pares el máximo. Así el jugador nota que la segunda vuelta
 * aprieta más, y el resultado es reproducible —dos jugadores en el nivel 40 se
 * encuentran exactamente el mismo jefe—, que con azar puro no pasaría.
 */
export function heartsForSlot(slot: number, cycle: number): number[] {
  const harder = cycle % 2 === 0;
  switch (kindForSlot(slot)) {
    case 'gauntlet':
      // Lv 6: dos comunes con 2 corazones. Lv 16: los mismos, pero con 3.
      return slot === 6 ? [2, 2] : [3, 3];
    case 'elite':
      return [harder ? 5 : 4];
    case 'boss':
      return [harder ? 7 : 6];
    default:
      return [3];
  }
}

/**
 * Nombres que ve el jugador, por tipo de nivel.
 *
 * El ciclo es un detalle de implementación y no debe notarse desde la app: si
 * el nivel 20 y el 40 se llamaran igual, el bucle quedaría a la vista. Por eso
 * cada vuelta estrena nombre, tomándolo de estas listas por el número de nivel.
 * Cuando se acaban, se vuelve a empezar, pero para entonces el jugador lleva
 * cien niveles.
 */
const NAME_POOLS: Record<Exclude<LevelKind, 'basic'>, string[]> = {
  // El doble de largo que las demás: hay dos gauntlets por vuelta, así que se
  // gastan al doble de ritmo y necesitan el doble de nombres para durar igual.
  gauntlet: [
    'Doble ración',
    'Vienen en pareja',
    'Dos por el precio de uno',
    'Fila india',
    'Uno detrás de otro',
    'Sin descanso',
    'Turno doble',
    'La cola del ridículo',
    'Segundo asalto incluido',
    'No venían solos',
    'Traían refuerzos',
    'Se avisaron entre ellos',
    'Tándem lamentable',
    'Dúo desafinado',
    'Relevo mixto',
    'Dos manos, dos problemas',
    'Uno se cansa antes',
    'Vienen de dos en dos',
    'La pareja de hecho',
    'Ni uno ni dos: dos',
  ],
  elite: [
    'Algo se acerca',
    'Esto ya es serio',
    'Categoría superior',
    'Sube el listón',
    'Aquí se acaba lo fácil',
    'Peso pesado',
    'Con reservas',
    'El que no perdona',
    'Un escalón más',
    'Se pone interesante',
  ],
  boss: [
    'El Lunes eterno',
    'Punto de no retorno',
    'Aquí duele',
    'El muro',
    'Sin excusas',
    'A vida o muerte',
    'El que todos temen',
    'Última parada',
    'Nadie pasa de aquí',
    'El final de algo',
  ],
};

/** Ranuras del ciclo que plantean cada tipo de combate, en orden. */
const SLOTS_BY_KIND: Record<LevelKind, number[]> = (() => {
  const out: Record<LevelKind, number[]> = {
    basic: [],
    gauntlet: [],
    elite: [],
    boss: [],
  };
  for (let slot = 1; slot <= CYCLE_LENGTH; slot++)
    out[kindForSlot(slot)].push(slot);
  return out;
})();

/**
 * Nombre que se le enseña al jugador para un nivel.
 *
 * Los niveles corrientes no llevan nombre: la app pone "Nivel N" y ya. Los
 * especiales sacan uno de la lista según **cuántos niveles de su tipo han
 * salido antes**, no según la vuelta.
 *
 * La diferencia importa: hay dos gauntlets por vuelta (las ranuras 6 y 16), así
 * que contando por vueltas los niveles 206 y 216 acababan llamándose igual y el
 * bucle asomaba dentro de una misma pantalla. Contando apariciones, cada
 * gauntlet estrena nombre.
 */
export function displayNameForLevel(level: number, kind: LevelKind): string {
  if (kind === 'basic') return '';

  const n = Math.max(1, Math.trunc(level) || 1);
  const slot = ((n - 1) % CYCLE_LENGTH) + 1;
  const turn = Math.floor((n - 1) / CYCLE_LENGTH);

  const slots = SLOTS_BY_KIND[kind];
  // Si el panel cambió el tipo de una ranura, no estará en la lista: se toma
  // la primera posición y a seguir. Sigue siendo estable para ese nivel.
  const within = Math.max(0, slots.indexOf(slot));
  const ordinal = turn * Math.max(1, slots.length) + within;

  const pool = NAME_POOLS[kind];
  return pool[ordinal % pool.length];
}

/** La plantilla por defecto de las 20 ranuras, la que siembra la migración. */
export const DEFAULT_CYCLE: CycleSlotSpec[] = Array.from(
  { length: CYCLE_LENGTH },
  (_, i) => {
    const slot = i + 1;
    const kind = kindForSlot(slot);
    const hearts = heartsForSlot(slot, 1);
    const alt = heartsForSlot(slot, 2);
    const sameAsBase =
      alt.length === hearts.length && alt.every((h, j) => h === hearts[j]);

    return {
      slot,
      // Vacío a propósito: el nombre que ve el jugador se genera por nivel,
      // no por ranura, para que no se repita cada vuelta. Este campo es una
      // etiqueta interna del panel.
      name: '',
      kind,
      enemyClass: enemyClassForKind(kind),
      enemyCount: hearts.length,
      heartsPerEnemy: hearts,
      // Sólo las ranuras con horquilla guardan variante.
      heartsPerEnemyAlt: sameAsBase ? [] : alt,
      playerHearts: PLAYER_HEARTS,
    } satisfies CycleSlotSpec;
  },
);

// ------------------------------------------------------------------ economía

/**
 * La campaña paga menos que el PvP a propósito.
 *
 * Se juega contra una máquina predecible y sin rival que se queje, así que si
 * pagara igual sería el camino corto para inflar la cuenta. Los números de aquí
 * están muy por debajo de `ROUND_REWARD` (40) y `WIN_REWARD` (100).
 */
export const CAMPAIGN_ROUND_REWARD = 8;
export const CAMPAIGN_WIN_REWARD = 30;

/** Multiplicador del premio según el tipo de nivel. */
export const KIND_REWARD_MULTIPLIER: Record<LevelKind, number> = {
  basic: 1,
  gauntlet: 1.5,
  elite: 2,
  boss: 4,
};

/**
 * Lo que se cobra al repetir un nivel ya superado.
 *
 * Rejugar sigue teniendo premio —hay que poder entrenar— pero a una cuarta
 * parte, para que moler el nivel 1 no compita con jugar de verdad.
 */
export const REPLAY_REWARD_RATIO = 0.25;

/** Créditos de consolación al perder un nivel. */
export const CAMPAIGN_LOSS_REWARD = 5;

/** Premio de un nivel, ya redondeado. */
export function campaignReward(params: {
  kind: LevelKind;
  roundsWon: number;
  won: boolean;
  firstClear: boolean;
}): number {
  const { kind, roundsWon, won, firstClear } = params;
  if (!won) return CAMPAIGN_LOSS_REWARD;

  const base =
    roundsWon * CAMPAIGN_ROUND_REWARD +
    CAMPAIGN_WIN_REWARD * KIND_REWARD_MULTIPLIER[kind];

  return Math.round(firstClear ? base : base * REPLAY_REWARD_RATIO);
}

// ------------------------------------------------------------------------ IA

/**
 * Cuánto lee cada clase las manías del jugador, de 0 a 1.
 *
 * Un enemigo puede sobrescribir su valor desde el panel; esto es sólo el punto
 * de partida. El común es casi puro azar para que los primeros niveles no
 * frustren; el jefe acierta la mitad de las veces, que ya duele.
 */
export const COUNTER_RATE_BY_CLASS: Record<EnemyClass, number> = {
  Basic: 0.1,
  Elite: 0.35,
  Boss: 0.5,
};

/**
 * Cuánto empuja la última jugada del jugador en la predicción del enemigo.
 *
 * No sustituye al análisis de frecuencias, se suma a él (ver `predictNext`).
 * A 0.25 hace falta que el jugador se atasque repitiendo para que la última
 * jugada mande sobre su manía de siempre, que es justo cuando aporta algo.
 */
export const LAST_MOVE_WEIGHT_BY_CLASS: Record<EnemyClass, number> = {
  Basic: 0,
  Elite: 0,
  // Sólo el jefe reacciona a lo que acabas de tirar.
  Boss: 0.25,
};

/** Máximo de rondas de un combate de campaña antes de resolver por corazones. */
export const CAMPAIGN_MAX_ROUNDS = 15;
