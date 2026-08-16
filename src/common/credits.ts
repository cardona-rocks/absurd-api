/**
 * Movimientos de créditos.
 *
 * Todo cambio en el monedero pasa por aquí para que la racha de acumulación
 * —la que mide el logro "Acaparador"— no dependa de que cada sitio se acuerde
 * de actualizarla. Ingresar suma a la racha; gastar la deja a cero, sea el
 * gasto que sea.
 */

/** Lo mínimo que necesita esta función de un usuario. */
export interface CreditHolder {
  credits: number;
  stats: { creditsEarned?: number; creditsHoarded?: number };
}

export function applyCredits(user: CreditHolder, delta: number): void {
  if (!Number.isFinite(delta) || delta === 0) return;

  if (delta > 0) {
    user.credits += delta;
    user.stats.creditsHoarded = (user.stats.creditsHoarded ?? 0) + delta;
    return;
  }

  // El monedero nunca baja de cero, aunque el cobro sea mayor que el saldo.
  user.credits = Math.max(0, user.credits + delta);
  // Gastar rompe la acumulación: el Acaparador vuelve a empezar.
  user.stats.creditsHoarded = 0;
}
