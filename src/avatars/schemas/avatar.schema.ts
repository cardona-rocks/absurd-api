import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WeaponSchema } from './weapon.schema';
import { SpritesSchema } from './sprites.schema';

@Schema({ _id: false })
export class AvatarStatsSchema {
  @Prop({ default: 0 })
  wins: number;

  @Prop({ default: 0 })
  loses: number;

  @Prop({ default: 0 })
  draws: number;
}

@Schema({ _id: false })
export class WeaponsSchema {
  @Prop({ type: WeaponSchema, default: () => ({}) })
  rock: WeaponSchema;

  @Prop({ type: WeaponSchema, default: () => ({}) })
  paper: WeaponSchema;

  @Prop({ type: WeaponSchema, default: () => ({}) })
  scissors: WeaponSchema;
}

export type AvatarDocument = Avatar & Document;

@Schema({ timestamps: true })
export class Avatar {
  @Prop({ required: true })
  name: string;

  @Prop({ type: WeaponsSchema, default: () => ({}) })
  weapons: WeaponsSchema;

  @Prop({ type: SpritesSchema, default: () => ({}) })
  sprites: SpritesSchema;

  @Prop({ type: AvatarStatsSchema, default: () => ({}) })
  stats: AvatarStatsSchema;

  @Prop({ default: 0 })
  price: number;
}

export const AvatarSchema = SchemaFactory.createForClass(Avatar);
