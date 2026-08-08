import { Prop, Schema } from '@nestjs/mongoose';
import { POWERUP_IDS } from '../../common/constants/game';
import type { PowerUpId } from '../../common/constants/game';

/** Un power up en el inventario del usuario, con la cantidad disponible. */
@Schema({ _id: false })
export class PowerUpItemSchema {
  @Prop({ required: true, enum: POWERUP_IDS })
  powerUpId: PowerUpId;

  @Prop({ default: 0, min: 0 })
  quantity: number;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}
