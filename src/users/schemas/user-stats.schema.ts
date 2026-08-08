import { Prop, Schema } from '@nestjs/mongoose';

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
}
