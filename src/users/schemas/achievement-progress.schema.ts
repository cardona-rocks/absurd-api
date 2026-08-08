import { Prop, Schema } from '@nestjs/mongoose';

/** Progreso del usuario sobre un logro del catálogo. */
@Schema({ _id: false })
export class AchievementProgressSchema {
  @Prop({ required: true })
  achievementId: string;

  @Prop({ default: 0, min: 0 })
  progress: number;

  @Prop({ default: false })
  unlocked: boolean;

  /** Si ya reclamó la recompensa en créditos. */
  @Prop({ default: false })
  claimed: boolean;

  @Prop({ type: Date, default: null })
  unlockedAt: Date | null;
}
