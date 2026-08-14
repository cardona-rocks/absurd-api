import { Prop, Schema } from '@nestjs/mongoose';

/**
 * Avance del jugador en la campaña.
 *
 * Va aparte de `stats` a propósito: la campaña se juega contra la máquina y no
 * debe mover el récord de PvP ni el ranking global. Lo único que comparten es
 * el monedero.
 */
@Schema({ _id: false })
export class CampaignProgressSchema {
  /** Nivel al que ha llegado. Es el más alto que puede jugar. */
  @Prop({ default: 1, min: 1 })
  level: number;

  /** Niveles superados en total. */
  @Prop({ default: 0 })
  cleared: number;

  @Prop({ default: 0 })
  wins: number;

  @Prop({ default: 0 })
  loses: number;

  /** El nivel más alto alcanzado, aunque luego repita otros más bajos. */
  @Prop({ default: 1 })
  bestLevel: number;

  @Prop({ type: Date, default: null })
  lastPlayedAt: Date | null;
}
