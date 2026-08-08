import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WeaponSchema } from './weapon.schema';
import { SpritesSchema } from './sprites.schema';
import { RARITIES } from '../../common/constants/game';
import type { Rarity } from '../../common/constants/game';

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

  /**
   * Identificador estable usado por la app para elegir la ilustración
   * (por ejemplo 'melenas', 'divorciado', 'tostador').
   */
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  /** Frase corta de personalidad que se muestra en la carta. */
  @Prop({ default: '' })
  tagline: string;

  /** Habilidad característica, solo texto de sabor por ahora. */
  @Prop({ default: '' })
  ability: string;

  @Prop({ enum: RARITIES, default: 'comun' })
  rarity: Rarity;

  /** Orden de aparición en la galería. */
  @Prop({ default: 0 })
  order: number;

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

AvatarSchema.index({ order: 1 });
