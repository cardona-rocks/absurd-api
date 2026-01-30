import { Prop, Schema } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
export class AttackWeaponSchema {
  @Prop({ default: '' })
  load: string;

  @Prop({ type: [String], default: [] })
  attack: string[];

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  settings: Record<string, unknown>;
}
