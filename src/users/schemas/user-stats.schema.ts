import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
export class UserStatsSchema {
  @Prop({ default: 0 })
  wins: number;

  @Prop({ default: 0 })
  draws: number;

  @Prop({ default: 0 })
  loses: number;
}
