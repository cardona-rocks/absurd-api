import { BEATS, CHOICES } from '../common/constants/game';
import type { Choice } from '../common/constants/game';

/**
 * La cabeza de los enemigos de campaña.
 *
 * Un rival que juega al azar puro es justo pero aburrido: da igual lo que
 * hagas. Aquí el enemigo apuesta, con cierta probabilidad, a que el jugador
 * repite sus manías, y responde a esa apuesta. Cuanto más alta su clase, más a
 * menudo lo intenta.
 *
 * Todo es puro y con el azar inyectable, para poder medir el sesgo en un test
 * en vez de creérselo.
 */

/** La jugada que le gana a otra: piedra ← papel, papel ← tijera, tijera ← piedra. */
export const COUNTER: Record<Choice, Choice> = (() => {
  const out = {} as Record<Choice, Choice>;
  for (const c of CHOICES) out[BEATS[c]] = c;
  return out;
})();

export interface EnemyBrain {
  /** Probabilidad de intentar leer al jugador en vez de tirar al azar, 0 a 1. */
  counterRate: number;
  /**
   * Cuánto empuja la última jugada a la predicción, 0 a 1.
   *
   * A 0 el enemigo sólo mira la manía general del jugador. Por encima de 0
   * también tiene en cuenta lo que acaba de tirar, pero como un empujón sobre
   * las frecuencias, no en lugar de ellas (ver `predictNext`).
   */
  lastMoveWeight: number;
}

/**
 * La jugada que más repite el jugador.
 *
 * Los empates se rompen por el orden fijo de `CHOICES` y no al azar: dos
 * partidas iguales deben dar el mismo enemigo, y un empate a ceros (sin
 * historial) se resuelve fuera, tirando al azar.
 */
export function mostUsed(history: Choice[]): Choice | null {
  if (!history.length) return null;
  const counts = new Map<Choice, number>(CHOICES.map((c) => [c, 0]));
  for (const h of history) counts.set(h, (counts.get(h) ?? 0) + 1);

  let best: Choice = CHOICES[0];
  for (const c of CHOICES) {
    if ((counts.get(c) ?? 0) > (counts.get(best) ?? 0)) best = c;
  }
  return best;
}

/**
 * A qué va a tirar el jugador, según lo que lleva hecho.
 *
 * Las dos señales se **suman**, no se turnan. El primer intento hacía que el
 * jefe usara la última jugada *en lugar de* las frecuencias la mitad de las
 * veces, y eso lo dejaba al nivel de la élite pese a tener más puntería:
 * contra alguien de manía estable, "lo último que tiró" predice peor que "lo
 * que más tira", así que sustituir una señal buena por una mala se comía la
 * ventaja. Sumándolas, el peso de la última jugada sólo puede aportar: decide
 * cuando el jugador se atasca repitiendo y se queda callado cuando no.
 */
export function predictNext(
  history: Choice[],
  lastMoveWeight: number,
): Choice | null {
  if (!history.length) return null;

  const last = history[history.length - 1];
  const weight = Math.min(1, Math.max(0, lastMoveWeight));

  let best: Choice | null = null;
  let bestScore = -Infinity;

  for (const c of CHOICES) {
    const share = history.filter((h) => h === c).length / history.length;
    const score = share + (c === last ? weight : 0);
    // El orden fijo de CHOICES rompe los empates: sin azar, reproducible.
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/**
 * Elige la jugada del enemigo.
 *
 * `random` se inyecta para poder fijar el azar en los tests; en producción es
 * `Math.random`.
 */
export function pickEnemyChoice(
  brain: EnemyBrain,
  history: Choice[],
  random: () => number = Math.random,
): Choice {
  const rate = Math.min(1, Math.max(0, brain.counterRate));

  // ¿Toca leer al jugador o tirar a ciegas?
  if (random() >= rate) return randomChoice(random);

  // El jefe pondera además lo que acabas de tirar; los demás, sólo tu manía.
  const predicted = predictNext(history, brain.lastMoveWeight);

  // Sin historial no hay nada que leer: al azar, como todos.
  if (!predicted) return randomChoice(random);
  return COUNTER[predicted];
}

function randomChoice(random: () => number): Choice {
  return CHOICES[
    Math.min(CHOICES.length - 1, Math.floor(random() * CHOICES.length))
  ];
}
