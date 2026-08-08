/**
 * A.b.s.u.r.d. — reglas y economía del juego.
 *
 * El combate es "mejor de 5": cada jugador empieza con 3 corazones y pierde uno
 * por cada ronda perdida. El primero que se queda sin corazones pierde el combate.
 * Los empates no cuestan corazones.
 */

/** Corazones base con los que empieza cada jugador. */
export const BASE_HEARTS = 3;

/** Corazones extra que otorga el power up "Vida Extra". */
export const EXTRA_LIFE_HEARTS = 1;

/** Máximo de rondas jugables antes de resolver por corazones restantes. */
export const MAX_ROUNDS = 9;

/** Segundos que tiene un jugador para elegir en cada ronda. */
export const ROUND_TIMEOUT_SECONDS = 20;

/** Milisegundos de inactividad total antes de perder por abandono. */
export const INACTIVITY_MS = 60 * 1000;

/** Milisegundos que un jugador puede estar desconectado antes de perder. */
export const RECONNECT_GRACE_MS = 30 * 1000;

/** Créditos de regalo al registrarse (alcanzan para el primer avatar). */
export const SIGNUP_CREDITS = 600;

/** Créditos por ganar un combate. */
export const WIN_REWARD = 100;

/** Créditos por cada ronda ganada, se pagan aunque pierdas el combate. */
export const ROUND_REWARD = 40;

/** Créditos de consolación por perder un combate. */
export const LOSS_REWARD = 20;

/** Multiplicador de premio del power up "Doble o Nada" (o 0 si sale mal). */
export const DOUBLE_OR_NOTHING_MULTIPLIER = 2;

export const CHOICES = ['rock', 'paper', 'scissors'] as const;
export type Choice = (typeof CHOICES)[number];

/** Qué le gana a qué. */
export const BEATS: Record<Choice, Choice> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

export type RoundOutcome = 'player1' | 'player2' | 'draw';

export function resolveRound(p1: Choice, p2: Choice): RoundOutcome {
  if (p1 === p2) return 'draw';
  return BEATS[p1] === p2 ? 'player1' : 'player2';
}

/** Rarezas de avatar, de menor a mayor. */
export const RARITIES = ['comun', 'raro', 'epico', 'legendario'] as const;
export type Rarity = (typeof RARITIES)[number];

/** Identificadores de los power ups del catálogo. */
export const POWERUP_IDS = [
  'escudo',
  'critico',
  'vida',
  'revelar',
  'curita',
  'doble',
] as const;
export type PowerUpId = (typeof POWERUP_IDS)[number];

/** Power ups que se activan al empezar el combate, no durante una ronda. */
export const PRE_MATCH_POWERUPS: PowerUpId[] = ['vida', 'doble'];

/** Máximo de power ups equipables por combate. */
export const MAX_EQUIPPED_POWERUPS = 3;
