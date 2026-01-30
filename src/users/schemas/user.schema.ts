import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserStatsSchema } from './user-stats.schema';
import { CollectionItemSchema } from './collection-item.schema';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: false })
  password?: string;

  @Prop({ default: 10 })
  credits: number;

  @Prop({ type: Types.ObjectId, ref: 'Avatar', default: null })
  avatar: Types.ObjectId | null;

  @Prop({ type: UserStatsSchema, default: () => ({}) })
  stats: UserStatsSchema;

  @Prop({ type: [CollectionItemSchema], default: [] })
  collection: CollectionItemSchema[];

  @Prop({ type: String, default: null })
  googleId?: string | null;

  @Prop({ type: String, default: null })
  appleId?: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
