import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CHOICES, POWERUP_IDS } from '../../common/constants/game';
import type { Choice, PowerUpId } from '../../common/constants/game';
import { LEVEL_KINDS } from '../../common/constants/campaign';
import type { LevelKind } from '../../common/constants/campaign';
import { ENEMY_CLASSES } from '../../common/constants/catalog';
import type { EnemyClass } from '../../common/constants/catalog';

/** Un enemigo dentro de un combate en curso. */
@Schema({ _id: false })
export class RunEnemySchema {
  @Prop({ type: Types.ObjectId, ref: 'Avatar', required: true })
  avatarId: Types.ObjectId;

  /** Copia del nombre y el slug: si luego se edita el avatar, el historial no miente. */
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  slug: string;

  @Prop({ enum: ENEMY_CLASSES, default: 'Basic' })
  class: EnemyClass;

  @Prop({ required: true, min: 0 })
  hearts: number;

  @Prop({ required: true, min: 1 })
  maxHearts: number;

  /** Cuánto lee las manías del jugador, ya resuelto para este combate. */
  @Prop({ default: 0.1, min: 0, max: 1 })
  counterRate: number;

  @Prop({ default: false })
  defeated: boolean;
}

/** Una ronda jugada contra uno de los enemigos. */
@Schema({ _id: false })
export class RunRoundSchema {
  /** Contra qué enemigo del nivel se jugó, por índice. */
  @Prop({ required: true, min: 0 })
  enemyIndex: number;

  @Prop({ enum: CHOICES, required: true })
  playerChoice: Choice;

  @Prop({ enum: CHOICES, required: true })
  enemyChoice: Choice;

  @Prop({ enum: ['player', 'enemy', 'draw'], required: true })
  winner: 'player' | 'enemy' | 'draw';

  @Prop({ required: true })
  playerHearts: number;

  @Prop({ required: true })
  enemyHearts: number;

  /** Un power up cambió el resultado natural de la ronda. */
  @Prop({ default: false })
  altered: boolean;

  @Prop({ default: Date.now })
  playedAt: Date;
}

export type CampaignRunDocument = CampaignRun & Document;

/**
 * Un intento de un nivel de campaña.
 *
 * Aunque se juegue en solitario, manda el servidor: el cliente envía su jugada
 * y aquí se decide la del enemigo y quién gana la ronda. La app nunca calcula
 * un resultado, igual que en el PvP.
 */
@Schema({ timestamps: true })
export class CampaignRun {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  level: number;

  @Prop({ required: true, min: 1 })
  slot: number;

  @Prop({ required: true, min: 1 })
  cycle: number;

  @Prop({ enum: LEVEL_KINDS, default: 'basic' })
  kind: LevelKind;

  @Prop({ default: '' })
  levelName: string;

  @Prop({
    enum: ['In progress', 'Complete', 'Abandoned'],
    default: 'In progress',
  })
  status: 'In progress' | 'Complete' | 'Abandoned';

  @Prop({ default: false })
  won: boolean;

  @Prop({ required: true, min: 0 })
  playerHearts: number;

  @Prop({ required: true, min: 1 })
  playerMaxHearts: number;

  /** Los enemigos del nivel, en el orden en que salen. */
  @Prop({ type: [RunEnemySchema], default: [] })
  enemies: RunEnemySchema[];

  /** A cuál se está enfrentando ahora mismo. */
  @Prop({ default: 0, min: 0 })
  currentEnemy: number;

  @Prop({ type: [RunRoundSchema], default: [] })
  rounds: RunRoundSchema[];

  @Prop({ type: [String], enum: POWERUP_IDS, default: [] })
  equippedPowerUps: PowerUpId[];

  @Prop({ type: [String], enum: POWERUP_IDS, default: [] })
  usedPowerUps: PowerUpId[];

  @Prop({ default: false })
  shieldActive: boolean;

  @Prop({ default: false })
  criticalArmed: boolean;

  @Prop({ default: 0 })
  creditsEarned: number;

  /**
   * Era la primera vez que se superaba este nivel.
   *
   * Se decide al empezar, no al acabar: si no, rejugar un nivel ya superado
   * pagaría el premio completo cada vez.
   */
  @Prop({ default: true })
  firstClear: boolean;

  @Prop({ type: String, default: null })
  endReason: 'hearts' | 'round-limit' | 'forfeit' | null;

  @Prop({ type: Date, default: null })
  finishedAt: Date | null;
}

export const CampaignRunSchema = SchemaFactory.createForClass(CampaignRun);

// Buscar el intento en curso de un jugador es la consulta más frecuente.
CampaignRunSchema.index({ userId: 1, status: 1 });
CampaignRunSchema.index({ userId: 1, level: 1 });
