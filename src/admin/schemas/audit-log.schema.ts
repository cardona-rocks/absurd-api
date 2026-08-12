import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

/** Registro de toda acción hecha desde el panel, para saber quién cambió qué. */
@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actor: Types.ObjectId;

  /** Nombre del actor en el momento del cambio, por si luego se borra. */
  @Prop({ default: '' })
  actorName: string;

  /** Qué se hizo, p. ej. 'avatar.update' o 'user.ban'. */
  @Prop({ required: true })
  action: string;

  /** Tipo de entidad afectada: 'avatar', 'user', 'match'… */
  @Prop({ required: true })
  entity: string;

  @Prop({ type: String, default: null })
  entityId: string | null;

  /** Resumen legible de lo ocurrido. */
  @Prop({ default: '' })
  summary: string;

  /** Datos extra: valores antes y después, motivo, importes… */
  @Prop({ type: Object, default: {} })
  meta: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1 });
AuditLogSchema.index({ actor: 1 });
