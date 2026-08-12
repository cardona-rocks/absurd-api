import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WeaponSchema } from './weapon.schema';
import { SpritesSchema } from './sprites.schema';
import { CATEGORIES } from '../../common/constants/catalog';
import type { Category } from '../../common/constants/catalog';

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
  @Prop({ required: true, trim: true })
  name: string;

  /**
   * Identificador estable que la app usa para elegir la ilustración local
   * cuando el avatar todavía no tiene sprites subidos.
   */
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  /** Descripción larga que se muestra en la ficha. */
  @Prop({ default: '' })
  description: string;

  /** Frase corta de personalidad. */
  @Prop({ default: '' })
  tagline: string;

  /** Habilidad característica, por ahora solo texto de sabor. */
  @Prop({ default: '' })
  ability: string;

  @Prop({ enum: CATEGORIES, default: 'Basic' })
  category: Category;

  /** Coste en créditos. */
  @Prop({ default: 0, min: 0 })
  price: number;

  /** Orden de aparición en la galería. */
  @Prop({ default: 0 })
  order: number;

  /** Oculto en la tienda: no se lista a los jugadores. */
  @Prop({ default: false })
  hidden: boolean;

  /** Fuera de circulación: no se puede comprar, pero quien lo tenga lo conserva. */
  @Prop({ default: false })
  retired: boolean;

  @Prop({ type: WeaponsSchema, default: () => ({}) })
  weapons: WeaponsSchema;

  @Prop({ type: SpritesSchema, default: () => ({}) })
  sprites: SpritesSchema;

  @Prop({ type: AvatarStatsSchema, default: () => ({}) })
  stats: AvatarStatsSchema;
}

export const AvatarSchema = SchemaFactory.createForClass(Avatar);

AvatarSchema.index({ order: 1 });
AvatarSchema.index({ category: 1 });
AvatarSchema.index({ hidden: 1, retired: 1 });
