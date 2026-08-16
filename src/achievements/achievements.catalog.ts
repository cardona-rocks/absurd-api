/**
 * Catálogo de logros.
 *
 * Hay dos formas de logro:
 *
 * - **Series**: una misma meta que se repite subiendo el listón. Al alcanzar un
 *   escalón se abre el siguiente, de bronce a diamante. El jugador sólo ve el
 *   escalón en el que está y los que ya se ganó, así que la lista no se llena
 *   de metas inalcanzables.
 * - **Sueltos**: un único objetivo, sin continuación.
 *
 * El servicio recalcula el progreso a partir del usuario después de cada
 * evento, así que añadir un logro aquí basta para que empiece a contar; no hace
 * falta migrar a nadie.
 */
import { POWERUP_IDS } from '../common/constants/game';
import type { PowerUpId } from '../common/constants/game';

/** Escalones de una serie, de menor a mayor. */
export const TIERS = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  bronze: 'Bronce',
  silver: 'Plata',
  gold: 'Oro',
  platinum: 'Platino',
  diamond: 'Diamante',
};

/**
 * Créditos por escalón.
 *
 * Suben mucho más rápido que el esfuerzo para que el diamante compense de
 * verdad; aun así, la serie entera paga menos que unas cuantas tardes de PvP.
 */
export const TIER_REWARDS: Record<Tier, number> = {
  bronze: 100,
  silver: 300,
  gold: 800,
  platinum: 2000,
  diamond: 5000,
};

/** Categorías con las que se agrupa la lista. */
export const ACHIEVEMENT_CATEGORIES = [
  'combate',
  'pvp',
  'campana',
  'arsenal',
  'coleccion',
  'constancia',
  'economia',
] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  combate: 'Combate',
  pvp: 'Contra jugadores',
  campana: 'Campaña',
  arsenal: 'Arsenal',
  coleccion: 'Colección',
  constancia: 'Constancia',
  economia: 'Economía',
};

/** Todo lo que se puede medir de un jugador. */
export type AchievementMetric =
  | 'wins'
  | 'winStreak'
  | 'loginStreak'
  | 'avatarsOwned'
  | 'matchesPlayed'
  | 'powerUpsBought'
  | 'perfectWins'
  | 'draws'
  | 'roundsWonRock'
  | 'roundsWonPaper'
  | 'roundsWonScissors'
  | 'campaignLevel'
  | 'creditsHoarded'
  | `powerUpUsed:${PowerUpId}`;

export interface AchievementDefinition {
  id: string;
  icon: string;
  name: string;
  desc: string;
  category: AchievementCategory;
  metric: AchievementMetric;
  /** Valor de la métrica necesario para desbloquear. */
  target: number;
  /** Créditos que otorga al reclamarlo. */
  reward: number;
  /** Serie a la que pertenece, o null si va suelto. */
  seriesId: string | null;
  /** Nombre de la serie, para agrupar en pantalla. */
  seriesName: string | null;
  tier: Tier | null;
  /** Posición dentro de la serie, empezando en 0. */
  tierIndex: number;
  /** Cuántos escalones tiene la serie. */
  tierCount: number;
}

interface SeriesSpec {
  id: string;
  icon: string;
  /** Nombre de la serie; el escalón se enseña aparte. */
  name: string;
  category: AchievementCategory;
  metric: AchievementMetric;
  targets: readonly [number, number, number, number, number];
  /** Descripción del escalón, según lo que pida. */
  desc: (target: number) => string;
}

const MOVE_SERIES: SeriesSpec[] = [
  {
    id: 'rondas-rock',
    icon: 'back_hand',
    name: 'Puño de Piedra',
    category: 'combate',
    metric: 'roundsWonRock',
    targets: [10, 50, 100, 500, 1000],
    desc: (n) => `Gana ${n} rondas lanzando piedra.`,
  },
  {
    id: 'rondas-paper',
    icon: 'sign_language',
    name: 'Mano de Papel',
    category: 'combate',
    metric: 'roundsWonPaper',
    targets: [10, 50, 100, 500, 1000],
    desc: (n) => `Gana ${n} rondas lanzando papel.`,
  },
  {
    id: 'rondas-scissors',
    icon: 'content_cut',
    name: 'Filo de Tijera',
    category: 'combate',
    metric: 'roundsWonScissors',
    targets: [10, 50, 100, 500, 1000],
    desc: (n) => `Gana ${n} rondas lanzando tijera.`,
  },
];

/** Nombre de cada power up para las series del arsenal. */
const POWERUP_NAMES: Record<PowerUpId, { name: string; icon: string }> = {
  escudo: { name: 'Escudo Absurdo', icon: 'shield' },
  critico: { name: 'Golpe Crítico', icon: 'bolt' },
  vida: { name: 'Vida Extra', icon: 'favorite' },
  revelar: { name: 'Ojo Chismoso', icon: 'visibility' },
  curita: { name: 'Curita Mágica', icon: 'healing' },
  doble: { name: 'Doble o Nada', icon: 'casino' },
};

const POWERUP_SERIES: SeriesSpec[] = POWERUP_IDS.map((id) => ({
  id: `powerup-${id}`,
  icon: POWERUP_NAMES[id].icon,
  name: POWERUP_NAMES[id].name,
  category: 'arsenal',
  metric: `powerUpUsed:${id}` as AchievementMetric,
  targets: [10, 50, 100, 200, 500] as const,
  desc: (n) => `Usa ${n} veces ${POWERUP_NAMES[id].name}.`,
}));

const SERIES: SeriesSpec[] = [
  ...MOVE_SERIES,
  {
    id: 'campana-nivel',
    icon: 'flag',
    name: 'Escalador',
    category: 'campana',
    metric: 'campaignLevel',
    targets: [50, 200, 500, 1000, 2000],
    desc: (n) => `Llega al nivel ${n} de la campaña.`,
  },
  ...POWERUP_SERIES,
  {
    id: 'pvp-jugados',
    icon: 'sports_kabaddi',
    name: 'Curtido',
    category: 'pvp',
    metric: 'matchesPlayed',
    targets: [50, 200, 500, 1000, 2000],
    desc: (n) => `Juega ${n} combates contra otros jugadores.`,
  },
  {
    id: 'pvp-ganados',
    icon: 'emoji_events',
    name: 'Vencedor',
    category: 'pvp',
    metric: 'wins',
    targets: [50, 200, 500, 1000, 2000],
    desc: (n) => `Gana ${n} combates contra otros jugadores.`,
  },
];

/** Convierte una serie en sus cinco logros. */
function expand(spec: SeriesSpec): AchievementDefinition[] {
  return spec.targets.map((target, i) => {
    const tier = TIERS[i];
    return {
      id: `${spec.id}-${tier}`,
      icon: spec.icon,
      name: spec.name,
      desc: spec.desc(target),
      category: spec.category,
      metric: spec.metric,
      target,
      reward: TIER_REWARDS[tier],
      seriesId: spec.id,
      seriesName: spec.name,
      tier,
      tierIndex: i,
      tierCount: spec.targets.length,
    };
  });
}

/** Logros de un solo escalón. */
const SINGLES: Omit<
  AchievementDefinition,
  'seriesId' | 'seriesName' | 'tier' | 'tierIndex' | 'tierCount'
>[] = [
  {
    id: 'primera-sangre',
    icon: 'sports_martial_arts',
    name: 'Primera Sangre',
    desc: 'Gana tu primer combate. Todos empiezan por algún lado.',
    category: 'pvp',
    metric: 'wins',
    target: 1,
    reward: 100,
  },
  {
    id: 'racha-3',
    icon: 'local_fire_department',
    name: 'En Racha',
    desc: 'Gana 3 combates seguidos sin perder ninguno.',
    category: 'pvp',
    metric: 'winStreak',
    target: 3,
    reward: 250,
  },
  {
    id: 'racha-10',
    icon: 'whatshot',
    name: 'Imparable',
    desc: 'Gana 10 combates seguidos. Ya es sospechoso.',
    category: 'pvp',
    metric: 'winStreak',
    target: 10,
    reward: 1000,
  },
  {
    id: 'fiel-10',
    icon: 'calendar_month',
    name: 'Fiel a lo Absurdo',
    desc: 'Conéctate 10 días seguidos.',
    category: 'constancia',
    metric: 'loginStreak',
    target: 10,
    reward: 500,
  },
  {
    id: 'coleccionista-5',
    icon: 'collections_bookmark',
    name: 'Coleccionista',
    desc: 'Consigue 5 avatares distintos.',
    category: 'coleccion',
    metric: 'avatarsOwned',
    target: 5,
    reward: 400,
  },
  {
    id: 'coleccionista-10',
    icon: 'auto_awesome',
    name: 'Coleccionista Total',
    desc: 'Consigue los 10 avatares. Sin vida social, pero completo.',
    category: 'coleccion',
    metric: 'avatarsOwned',
    target: 10,
    reward: 1500,
  },
  {
    id: 'perfecto',
    icon: 'shield_moon',
    name: 'Sin Despeinarse',
    desc: 'Gana un combate sin perder ni un corazón.',
    category: 'combate',
    metric: 'perfectWins',
    target: 1,
    reward: 350,
  },
  {
    id: 'armero',
    icon: 'inventory_2',
    name: 'Armero',
    desc: 'Compra 5 power ups. El dinero es para gastarlo.',
    category: 'arsenal',
    metric: 'powerUpsBought',
    target: 5,
    reward: 250,
  },
  {
    id: 'empatico',
    icon: 'handshake',
    name: 'Empático',
    desc: 'Empata 10 rondas. Grandes mentes piensan igual.',
    category: 'combate',
    metric: 'draws',
    target: 10,
    reward: 150,
  },
  {
    id: 'acaparador',
    icon: 'savings',
    name: 'Acaparador',
    desc: 'Junta 100.000 créditos sin gastar ni uno. Gastar reinicia la cuenta.',
    category: 'economia',
    metric: 'creditsHoarded',
    target: 100_000,
    reward: 10_000,
  },
];

export const ACHIEVEMENTS: AchievementDefinition[] = [
  ...SERIES.flatMap(expand),
  ...SINGLES.map((s) => ({
    ...s,
    seriesId: null,
    seriesName: null,
    tier: null,
    tierIndex: 0,
    tierCount: 1,
  })),
];

export const ACHIEVEMENT_MAP: Record<string, AchievementDefinition> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Los escalones de una serie, en orden. */
export const SERIES_TIERS: Record<string, AchievementDefinition[]> = (() => {
  const out: Record<string, AchievementDefinition[]> = {};
  for (const a of ACHIEVEMENTS) {
    if (!a.seriesId) continue;
    (out[a.seriesId] ??= []).push(a);
  }
  for (const list of Object.values(out)) {
    list.sort((x, y) => x.tierIndex - y.tierIndex);
  }
  return out;
})();
