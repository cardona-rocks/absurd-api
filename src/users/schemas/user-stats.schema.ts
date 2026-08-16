import { Prop, Schema } from '@nestjs/mongoose';
import { CHOICES, POWERUP_IDS } from '../../common/constants/game';
import type { Choice, PowerUpId } from '../../common/constants/game';

/** Rondas ganadas con cada jugada. Alimenta las series de Combate. */
@Schema({ _id: false })
export class RoundsByChoiceSchema {
  @Prop({ default: 0 })
  rock: number;

  @Prop({ default: 0 })
  paper: number;

  @Prop({ default: 0 })
  scissors: number;
}

/** Veces que se ha usado cada power up. Alimenta las series de Arsenal. */
@Schema({ _id: false })
export class PowerUpUsageSchema {
  @Prop({ default: 0 })
  escudo: number;

  @Prop({ default: 0 })
  critico: number;

  @Prop({ default: 0 })
  vida: number;

  @Prop({ default: 0 })
  revelar: number;

  @Prop({ default: 0 })
  curita: number;

  @Prop({ default: 0 })
  doble: number;
}

/** Claves válidas, para recorrerlas sin repetirlas a mano. */
export const CHOICE_KEYS: Choice[] = [...CHOICES];
export const POWERUP_KEYS: PowerUpId[] = [...POWERUP_IDS];

@Schema({ _id: false })
export class UserStatsSchema {
  /** Combates ganados. */
  @Prop({ default: 0 })
  wins: number;

  /** Combates empatados (raro, solo por límite de rondas). */
  @Prop({ default: 0 })
  draws: number;

  /** Combates perdidos. */
  @Prop({ default: 0 })
  loses: number;

  /** Combates jugados hasta el final. */
  @Prop({ default: 0 })
  matchesPlayed: number;

  /** Rondas ganadas en total. */
  @Prop({ default: 0 })
  roundsWon: number;

  /** Rondas perdidas en total. */
  @Prop({ default: 0 })
  roundsLost: number;

  /** Rondas empatadas en total. */
  @Prop({ default: 0 })
  roundDraws: number;

  /** Combates ganados sin perder ningún corazón. */
  @Prop({ default: 0 })
  perfectWins: number;

  /** Power ups comprados en total. */
  @Prop({ default: 0 })
  powerUpsBought: number;

  /** Créditos ganados jugando. */
  @Prop({ default: 0 })
  creditsEarned: number;

  /**
   * Créditos acumulados desde el último gasto.
   *
   * Cualquier compra la deja a cero: es la cuenta del logro "Acaparador".
   */
  @Prop({ default: 0 })
  creditsHoarded: number;

  /** Rondas ganadas con cada jugada, en PvP y en campaña. */
  @Prop({ type: RoundsByChoiceSchema, default: () => ({}) })
  roundsWonByChoice: RoundsByChoiceSchema;

  /** Veces que se ha activado cada power up. */
  @Prop({ type: PowerUpUsageSchema, default: () => ({}) })
  powerUpsUsed: PowerUpUsageSchema;
}
