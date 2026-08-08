import { Prop, Schema } from '@nestjs/mongoose';

/** Rachas del usuario: victorias seguidas y días seguidos conectado. */
@Schema({ _id: false })
export class StreakSchema {
  /** Victorias consecutivas actuales. */
  @Prop({ default: 0 })
  currentWins: number;

  /** Mejor racha de victorias histórica. */
  @Prop({ default: 0 })
  bestWins: number;

  /** Días consecutivos con al menos una conexión. */
  @Prop({ default: 0 })
  currentLoginDays: number;

  /** Mejor racha de días conectado. */
  @Prop({ default: 0 })
  bestLoginDays: number;

  /** Último día contabilizado, en formato YYYY-MM-DD (UTC). */
  @Prop({ type: String, default: null })
  lastLoginDay: string | null;
}
