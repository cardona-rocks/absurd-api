import { Prop, Schema } from '@nestjs/mongoose';

export type Choice = 'rock' | 'paper' | 'scissors';

@Schema({ _id: false })
export class RoundSchema {
  @Prop({ required: true, enum: ['rock', 'paper', 'scissors'] })
  player1Choice: Choice;

  @Prop({ required: true, enum: ['rock', 'paper', 'scissors'] })
  player2Choice: Choice;

  @Prop({ type: String, enum: ['player1', 'player2', 'draw'], default: null })
  winner: 'player1' | 'player2' | 'draw' | null;
}
