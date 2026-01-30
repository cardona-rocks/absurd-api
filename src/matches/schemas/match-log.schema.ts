import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
export class MatchLogSchema {
  @Prop({ default: () => new Date() })
  timestamp: Date;

  @Prop({ default: '' })
  message: string;
}
