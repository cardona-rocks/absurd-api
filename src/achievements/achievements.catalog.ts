/**
 * Catálogo de logros. Cada logro define cómo se mide su progreso; el servicio
 * de logros recalcula todo a partir del usuario después de cada evento.
 */
export type AchievementMetric =
  | 'wins'
  | 'winStreak'
  | 'loginStreak'
  | 'avatarsOwned'
  | 'matchesPlayed'
  | 'powerUpsBought'
  | 'perfectWins'
  | 'draws';

export interface AchievementDefinition {
  id: string;
  icon: string;
  name: string;
  desc: string;
  metric: AchievementMetric;
  /** Valor de la métrica necesario para desbloquear. */
  target: number;
  /** Créditos que otorga al reclamarlo. */
  reward: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'primera-sangre',
    icon: 'sports_martial_arts',
    name: 'Primera Sangre',
    desc: 'Gana tu primer combate. Todos empiezan por algún lado.',
    metric: 'wins',
    target: 1,
    reward: 100,
  },
  {
    id: 'racha-3',
    icon: 'local_fire_department',
    name: 'En Racha',
    desc: 'Gana 3 combates seguidos sin perder ninguno.',
    metric: 'winStreak',
    target: 3,
    reward: 250,
  },
  {
    id: 'racha-10',
    icon: 'whatshot',
    name: 'Imparable',
    desc: 'Gana 10 combates seguidos. Ya es sospechoso.',
    metric: 'winStreak',
    target: 10,
    reward: 1000,
  },
  {
    id: 'fiel-10',
    icon: 'calendar_month',
    name: 'Fiel a lo Absurdo',
    desc: 'Conéctate 10 días seguidos.',
    metric: 'loginStreak',
    target: 10,
    reward: 500,
  },
  {
    id: 'coleccionista-5',
    icon: 'collections_bookmark',
    name: 'Coleccionista',
    desc: 'Consigue 5 avatares distintos.',
    metric: 'avatarsOwned',
    target: 5,
    reward: 400,
  },
  {
    id: 'coleccionista-10',
    icon: 'auto_awesome',
    name: 'Coleccionista Total',
    desc: 'Consigue los 10 avatares. Sin vida social, pero completo.',
    metric: 'avatarsOwned',
    target: 10,
    reward: 1500,
  },
  {
    id: 'veterano-25',
    icon: 'military_tech',
    name: 'Veterano',
    desc: 'Juega 25 combates, ganes o pierdas.',
    metric: 'matchesPlayed',
    target: 25,
    reward: 300,
  },
  {
    id: 'campeon-25',
    icon: 'emoji_events',
    name: 'Campeón Ridículo',
    desc: 'Gana 25 combates en total.',
    metric: 'wins',
    target: 25,
    reward: 800,
  },
  {
    id: 'perfecto',
    icon: 'shield_moon',
    name: 'Sin Despeinarse',
    desc: 'Gana un combate sin perder ni un corazón.',
    metric: 'perfectWins',
    target: 1,
    reward: 350,
  },
  {
    id: 'armero',
    icon: 'inventory_2',
    name: 'Armero',
    desc: 'Compra 5 power ups. El dinero es para gastarlo.',
    metric: 'powerUpsBought',
    target: 5,
    reward: 250,
  },
  {
    id: 'empatico',
    icon: 'handshake',
    name: 'Empático',
    desc: 'Empata 10 rondas. Grandes mentes piensan igual.',
    metric: 'draws',
    target: 10,
    reward: 150,
  },
];

export const ACHIEVEMENT_MAP: Record<string, AchievementDefinition> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
