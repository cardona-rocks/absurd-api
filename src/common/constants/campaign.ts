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

const SLOT_NAMES: Record<number, string> = {
  6: 'Gauntlet: doble ración',
  10: 'Élite',
  16: 'Gauntlet: la revancha',
  20: 'Jefe de ciclo',
};

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
      name: SLOT_NAMES[slot] ?? '',
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
