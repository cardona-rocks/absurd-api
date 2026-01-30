import { Prop, Schema } from '@nestjs/mongoose';
import { AttackWeaponSchema } from './attack-weapon.schema';

@Schema({ _id: false })
export class AttackSpritesSchema {
  @Prop({ type: AttackWeaponSchema, default: () => ({}) })
  rock: AttackWeaponSchema;

  @Prop({ type: AttackWeaponSchema, default: () => ({}) })
  paper: AttackWeaponSchema;

  @Prop({ type: AttackWeaponSchema, default: () => ({}) })
  scissors: AttackWeaponSchema;
}

@Schema({ _id: false })
export class BaseSpritesSchema {
  @Prop({ type: [String], default: [] })
  backView: string[];

  @Prop({ type: [String], default: [] })
  frontView: string[];
}

@Schema({ _id: false })
export class DamageSpriteSchema {
  @Prop({ default: '' })
  id: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ type: Object, default: {} })
  settings: Record<string, unknown>;
}

@Schema({ _id: false })
export class SpritesSchema {
  @Prop({ default: '' })
  profile: string;

  @Prop({ type: BaseSpritesSchema, default: () => ({}) })
  base: BaseSpritesSchema;

  @Prop({ type: AttackSpritesSchema, default: () => ({}) })
  attack: AttackSpritesSchema;

  @Prop({ type: [DamageSpriteSchema], default: [] })
  damage: DamageSpriteSchema[];
}
