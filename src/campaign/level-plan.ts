import {
  CYCLE_LENGTH,
  DEFAULT_CYCLE,
  enemyClassForKind,
  kindForSlot,
  PLAYER_HEARTS,
} from '../common/constants/campaign';
import type { LevelKind } from '../common/constants/campaign';
import type { EnemyClass } from '../common/constants/catalog';

/**
 * De un número de nivel a un combate concreto.
 *
 * Todo lo de este archivo son funciones puras sobre datos planos: no toca la
 * base ni pide nada por red. Así el reparto de niveles —la regla más delicada
 * de la campaña— se puede comprobar entera con una tabla de casos.
 */

/**
 * Deja el nivel en un entero >= 1.
 *
 * Cualquier cosa que llegue de fuera —un parámetro de URL, un cliente viejo—
 * acaba en el nivel 1 en vez de tumbar el cálculo con un NaN que se propagaría
 * hasta la consulta de enemigos.
 */
export function normalizeLevel(level: number): number {
  const n = Math.trunc(Number(level));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Ranura del ciclo que ocupa un nivel: 1→1, 20→20, 21→1, 40→20. */
export function slotForLevel(level: number): number {
  return ((normalizeLevel(level) - 1) % CYCLE_LENGTH) + 1;
}

/** Vuelta a la que pertenece un nivel: 1..20 → 1, 21..40 → 2. */
export function cycleForLevel(level: number): number {
  return Math.floor((normalizeLevel(level) - 1) / CYCLE_LENGTH) + 1;
}

/** Forma mínima de un nivel guardado, sin depender de mongoose. */
export interface LevelConfig {
  slot: number;
  level: number | null;
  name?: string;
  kind?: LevelKind;
  enemyClass?: EnemyClass;
  enemyCount?: number;
  heartsPerEnemy?: number[];
  heartsPerEnemyAlt?: number[];
  playerHearts?: number;
  enemies?: unknown[];
  enabled?: boolean;
}

export interface LevelPlan {
  level: number;
  slot: number;
  cycle: number;
  name: string;
  kind: LevelKind;
  enemyClass: EnemyClass;
  enemyCount: number;
  /** Corazones de cada enemigo, uno por enemigo y ya resuelto para el ciclo. */
  hearts: number[];
  playerHearts: number;
  /** Enemigos fijados a mano en el panel, en orden. Vacío = los elige la campaña. */
  enemyIds: string[];
  /** De dónde salió la configuración, útil para el panel y para depurar. */
  source: 'override' | 'template' | 'default';
}

/**
 * Estira o recorta la lista de corazones hasta tener uno por enemigo.
 *
 * Si faltan valores se repite el último: es lo que menos sorprende al editar
 * un nivel en el panel y subir el número de enemigos sin tocar los corazones.
 */
function fitHearts(
  hearts: number[],
  count: number,
  fallback: number,
): number[] {
  const clean = hearts.filter((h) => Number.isFinite(h) && h > 0);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(clean[i] ?? clean[clean.length - 1] ?? fallback);
  }
  return out;
}

/**
 * Resuelve el combate de un nivel.
 *
 * Manda la excepción de ese nivel exacto; si no la hay, la plantilla de su
 * ranura; y si tampoco, la plantilla de fábrica, para que la campaña siga en
 * pie aunque no se haya sembrado nada.
 */
export function planLevel(level: number, configs: LevelConfig[]): LevelPlan {
  const n = normalizeLevel(level);
  const slot = slotForLevel(n);
  const cycle = cycleForLevel(n);

  const override = configs.find((c) => c.level === n && c.enabled !== false);
  const template = configs.find((c) => c.level == null && c.slot === slot);
  const fallback = DEFAULT_CYCLE[slot - 1];

  const cfg = override ?? template;
  const source: LevelPlan['source'] = override
    ? 'override'
    : template
      ? 'template'
      : 'default';

  const kind = cfg?.kind ?? fallback?.kind ?? kindForSlot(slot);
  const enemyCount = Math.max(1, cfg?.enemyCount ?? fallback?.enemyCount ?? 1);

  // Los ciclos pares usan la variante de corazones si la ranura la define.
  const base = cfg?.heartsPerEnemy ?? fallback?.heartsPerEnemy ?? [3];
  const alt = cfg?.heartsPerEnemyAlt ?? fallback?.heartsPerEnemyAlt ?? [];
  const chosen = cycle % 2 === 0 && alt.length ? alt : base;

  return {
    level: n,
    slot,
    cycle,
    name: cfg?.name || fallback?.name || `Nivel ${n}`,
    kind,
    enemyClass:
      cfg?.enemyClass ?? fallback?.enemyClass ?? enemyClassForKind(kind),
    enemyCount,
    hearts: fitHearts(chosen, enemyCount, 3),
    playerHearts: cfg?.playerHearts ?? fallback?.playerHearts ?? PLAYER_HEARTS,
    enemyIds: (cfg?.enemies ?? []).map((e) => String(e)),
    source,
  };
}

/**
 * Reparte los enemigos de un nivel entre los candidatos disponibles.
 *
 * `pool` llega ordenado por cercanía al nivel que se juega. Se toma una ventana
 * de los más cercanos y se rota dentro de ella según el número de nivel: así
 * dos niveles seguidos no sacan a la misma criatura, un gauntlet enfrenta a dos
 * distintas siempre que haya de dónde, y el resultado sigue siendo el mismo
 * cada vez que se juega ese nivel.
 *
 * Es genérico y puro para poder probarlo con una lista de nombres.
 */
export function pickFromPool<T>(pool: T[], count: number, level: number): T[] {
  if (!pool.length || count <= 0) return [];

  // La ventana nunca es menor que el número de enemigos: si hay candidatos de
  // sobra, un gauntlet no repite bicho.
  const window = pool.slice(0, Math.max(3, count));
  return Array.from(
    { length: count },
    (_, i) => window[(normalizeLevel(level) + i) % window.length],
  );
}

/**
 * Adelanto de los próximos niveles, para pintar el mapa de la campaña.
 *
 * Sólo describe qué se va a encontrar el jugador; no reserva enemigos ni toca
 * su progreso.
 */
export function planRange(
  from: number,
  count: number,
  configs: LevelConfig[],
): LevelPlan[] {
  const start = normalizeLevel(from);
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    planLevel(start + i, configs),
  );
}
