import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TournamentStatus =
  | 'Open'
  | 'In progress'
  | 'Complete'
  | 'Cancelled';

/** Un participante inscrito en el torneo. */
@Schema({ _id: false })
export class TournamentEntrant {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Avatar', required: true })
  avatarId: Types.ObjectId;

  /** Posición inicial en el bracket (0-based). */
  @Prop({ required: true })
  seed: number;

  @Prop({ default: false })
  eliminated: boolean;

  @Prop({ default: () => new Date() })
  joinedAt: Date;
}

/** Un enfrentamiento del bracket. */
@Schema({ _id: false })
export class TournamentMatchup {
  /** Ronda del bracket: 0 = primera ronda. */
  @Prop({ required: true })
  round: number;

  /** Posición dentro de la ronda. */
  @Prop({ required: true })
  slot: number;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  player1: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  player2: Types.ObjectId | null;

  /** Combate real que resuelve este cruce. */
  @Prop({ type: Types.ObjectId, ref: 'Match', default: null })
  matchId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  winner: Types.ObjectId | null;

  @Prop({
    enum: ['pending', 'ready', 'in-progress', 'complete'],
    default: 'pending',
  })
  status: 'pending' | 'ready' | 'in-progress' | 'complete';
}

export type TournamentDocument = Tournament & Document;

@Schema({ timestamps: true })
export class Tournament {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  /** Privado = solo se entra con código. */
  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ type: String, default: null, uppercase: true })
  joinCode: string | null;

  /** Número de plazas: 4 u 8. */
  @Prop({ default: 8, enum: [4, 8] })
  size: number;

  /** Créditos que cuesta inscribirse. */
  @Prop({ default: 0 })
  entryFee: number;

  /** Bote acumulado que se lleva el campeón. */
  @Prop({ default: 0 })
  prizePool: number;

  @Prop({
    enum: ['Open', 'In progress', 'Complete', 'Cancelled'],
    default: 'Open',
  })
  status: TournamentStatus;

  @Prop({ type: [TournamentEntrant], default: [] })
  entrants: TournamentEntrant[];

  @Prop({ type: [TournamentMatchup], default: [] })
  bracket: TournamentMatchup[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  champion: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  finishedAt: Date | null;
}

export const TournamentSchema = SchemaFactory.createForClass(Tournament);

TournamentSchema.index({ status: 1, isPrivate: 1, createdAt: -1 });
TournamentSchema.index({ joinCode: 1 }, { sparse: true });
