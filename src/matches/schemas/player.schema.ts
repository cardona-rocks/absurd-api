import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { POWERUP_IDS, BASE_HEARTS } from '../../common/constants/game';
import type { PowerUpId } from '../../common/constants/game';

@Schema({ _id: false })
export class PlayerSchema {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Avatar', required: true })
  avatarId: Types.ObjectId;

  /** Corazones restantes. Llegar a 0 pierde el combate. */
  @Prop({ default: BASE_HEARTS })
  hearts: number;

  /** Corazones con los que empezó (4 si usó Vida Extra). */
  @Prop({ default: BASE_HEARTS })
  maxHearts: number;

  /** Power ups equipados al entrar al combate. */
  @Prop({ type: [String], enum: POWERUP_IDS, default: [] })
  equippedPowerUps: PowerUpId[];

  /** Power ups ya gastados en este combate. */
  @Prop({ type: [String], enum: POWERUP_IDS, default: [] })
  usedPowerUps: PowerUpId[];

  /** Escudo activo que absorberá el próximo corazón perdido. */
  @Prop({ default: false })
  shieldActive: boolean;

  /** Golpe crítico armado para la próxima ronda. */
  @Prop({ default: false })
  criticalArmed: boolean;

  /** Créditos ganados al terminar el combate. */
  @Prop({ default: 0 })
  creditsEarned: number;

  @Prop({ default: false })
  ready: boolean;

  @Prop({ type: Date, default: null })
  disconnectedAt: Date | null;
}
