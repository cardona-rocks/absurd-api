import { Prop, Schema } from '@nestjs/mongoose';
import { CHOICES, POWERUP_IDS } from '../../common/constants/game';
import type { Choice, PowerUpId } from '../../common/constants/game';

export type { Choice };

@Schema({ _id: false })
export class RoundSchema {
  @Prop({ required: true, enum: CHOICES })
  player1Choice: Choice;

  @Prop({ required: true, enum: CHOICES })
  player2Choice: Choice;

  @Prop({ type: String, enum: ['player1', 'player2', 'draw'], default: null })
  winner: 'player1' | 'player2' | 'draw' | null;

  /** Power ups activados durante esta ronda por cada jugador. */
  @Prop({ type: [String], enum: POWERUP_IDS, default: [] })
  player1PowerUps: PowerUpId[];

  @Prop({ type: [String], enum: POWERUP_IDS, default: [] })
  player2PowerUps: PowerUpId[];

  /** Corazones restantes al terminar la ronda. */
  @Prop({ default: 0 })
  player1Hearts: number;

  @Prop({ default: 0 })
  player2Hearts: number;

  /** True si el resultado natural cambió por un power up. */
  @Prop({ default: false })
  altered: boolean;

  @Prop({ default: () => new Date() })
  playedAt: Date;
}
