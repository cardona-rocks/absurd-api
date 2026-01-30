import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ _id: false })
export class CollectionItemSchema {
  @Prop({ type: Types.ObjectId, ref: 'Avatar', required: true })
  avatar: Types.ObjectId;

  @Prop({ required: true })
  price: number;

  @Prop({ default: () => new Date() })
  timestamp: Date;
}
