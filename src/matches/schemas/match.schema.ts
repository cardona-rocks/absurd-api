import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PlayerSchema } from './player.schema';
import { RoundSchema } from './round.schema';
import { MatchLogSchema } from './match-log.schema';

export type MatchStatus =
  | 'Searching'
  | 'In progress'
  | 'Complete'
  | 'Cancelled';

/** Cómo se creó el combate. */
export type MatchMode = 'quick' | 'private' | 'tournament';

/** Por qué terminó el combate. */
export type MatchEndReason =
  | 'hearts'
  | 'inactivity'
  | 'disconnect'
  | 'forfeit'
  | 'round-limit'
  | null;

export type MatchDocument = Match & Document;

@Schema({ timestamps: true })
export class Match {
  @Prop({ type: PlayerSchema, required: true })
  player1: PlayerSchema;

  @Prop({ type: PlayerSchema, default: null })
  player2: PlayerSchema | null;

  @Prop({ type: [RoundSchema], default: [] })
  rounds: RoundSchema[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  matchWinner: Types.ObjectId | null;

  @Prop({
    enum: ['Searching', 'In progress', 'Complete', 'Cancelled'],
    default: 'Searching',
  })
  status: MatchStatus;

  @Prop({ enum: ['quick', 'private', 'tournament'], default: 'quick' })
  mode: MatchMode;

  /** Código de 6 caracteres para partidas privadas. */
  @Prop({ type: String, default: null, uppercase: true })
  roomCode: string | null;

  /** Torneo al que pertenece el combate, si aplica. */
  @Prop({ type: Types.ObjectId, ref: 'Tournament', default: null })
  tournamentId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  endReason: MatchEndReason;

  /** Combate anterior si este es una revancha. */
  @Prop({ type: Types.ObjectId, ref: 'Match', default: null })
  rematchOf: Types.ObjectId | null;

  @Prop({ type: [MatchLogSchema], default: [] })
  log: MatchLogSchema[];

  /** Marca de la última acción, usada para el control de inactividad. */
  @Prop({ type: Date, default: () => new Date() })
  lastActivityAt: Date;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  finishedAt: Date | null;

  @Prop({ default: () => new Date() })
  timestamp: Date;
}

export const MatchSchema = SchemaFactory.createForClass(Match);

MatchSchema.index({ status: 1, mode: 1, createdAt: 1 });
MatchSchema.index({ roomCode: 1 }, { sparse: true });
MatchSchema.index({ 'player1.userId': 1, status: 1 });
MatchSchema.index({ 'player2.userId': 1, status: 1 });
