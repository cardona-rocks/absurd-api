import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserStatsSchema } from './user-stats.schema';
import { CollectionItemSchema } from './collection-item.schema';
import { PowerUpItemSchema } from './powerup-item.schema';
import { AchievementProgressSchema } from './achievement-progress.schema';
import { StreakSchema } from './streak.schema';
import { CampaignProgressSchema } from './campaign-progress.schema';
import { SIGNUP_CREDITS } from '../../common/constants/game';
import { ROLES } from '../../common/constants/roles';
import type { Role } from '../../common/constants/roles';

export type UserDocument = User & Document;

/**
 * `collection` está en la lista de nombres reservados de Mongoose y por defecto
 * emite un aviso al arrancar. Lo mantenemos porque es el nombre que pide la
 * especificación y el que consume la app. Es seguro en Mongoose 9: internamente
 * usa `$collection` / `$__collection`, así que el path no tapa nada.
 */
@Schema({ timestamps: true, suppressReservedKeysWarning: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: false })
  password?: string;

  /** Edad declarada en el registro. */
  @Prop({ type: Number, default: null, min: 1, max: 120 })
  age: number | null;

  /** Rol. Solo `moderator` y `admin` entran al panel. */
  @Prop({ enum: ROLES, default: 'player' })
  role: Role;

  /** Obliga a cambiar la contraseña en el primer acceso. */
  @Prop({ default: false })
  mustChangePassword: boolean;

  // --------------------------------------------------------- moderación

  @Prop({ default: false })
  banned: boolean;

  @Prop({ type: String, default: null })
  bannedReason: string | null;

  @Prop({ type: Date, default: null })
  bannedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  bannedBy: Types.ObjectId | null;

  /** Nota interna del equipo, nunca se expone al jugador. */
  @Prop({ type: String, default: '' })
  moderationNote: string;

  // ------------------------------------------------------------- juego

  @Prop({ default: SIGNUP_CREDITS })
  credits: number;

  @Prop({ type: Types.ObjectId, ref: 'Avatar', default: null })
  avatar: Types.ObjectId | null;

  @Prop({ type: UserStatsSchema, default: () => ({}) })
  stats: UserStatsSchema;

  @Prop({ type: [CollectionItemSchema], default: [] })
  collection: CollectionItemSchema[];

  @Prop({ type: [PowerUpItemSchema], default: [] })
  powerUps: PowerUpItemSchema[];

  @Prop({ type: [AchievementProgressSchema], default: [] })
  achievements: AchievementProgressSchema[];

  @Prop({ type: StreakSchema, default: () => ({}) })
  streak: StreakSchema;

  /** Avance en la campaña, separado del récord de PvP. */
  @Prop({ type: CampaignProgressSchema, default: () => ({}) })
  campaign: CampaignProgressSchema;

  /** Cuenta de invitado creada sin credenciales. */
  @Prop({ default: false })
  isGuest: boolean;

  @Prop({ type: String, default: null })
  googleId?: string | null;

  @Prop({ type: String, default: null })
  appleId?: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

// El ranking ordena por victorias y desempata por menos derrotas.
UserSchema.index({ 'stats.wins': -1, 'stats.loses': 1 });
UserSchema.index({ googleId: 1 }, { sparse: true });
UserSchema.index({ appleId: 1 }, { sparse: true });
UserSchema.index({ role: 1 });
UserSchema.index({ banned: 1 });
// Búsqueda del panel por nombre o correo.
UserSchema.index({ name: 'text', email: 'text' });
