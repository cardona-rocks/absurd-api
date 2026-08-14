import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CreditPurchaseDocument = CreditPurchase & Document;

@Schema({ timestamps: true })
export class CreditPurchase {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: () => new Date() })
  timestamp: Date;
}

export const CreditPurchaseSchema =
  SchemaFactory.createForClass(CreditPurchase);
