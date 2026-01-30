import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PlayerSchema } from './player.schema';
import { RoundSchema } from './round.schema';
import { MatchLogSchema } from './match-log.schema';

export type MatchStatus = 'Searching' | 'In progress' | 'Complete';

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

  @Prop({ enum: ['Searching', 'In progress', 'Complete'], default: 'Searching' })
  status: MatchStatus;

  @Prop({ type: [MatchLogSchema], default: [] })
  log: MatchLogSchema[];

  @Prop({ default: () => new Date() })
  timestamp: Date;
}

export const MatchSchema = SchemaFactory.createForClass(Match);
