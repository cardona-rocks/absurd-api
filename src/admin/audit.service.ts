import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditEntry {
  actorId: string;
  actorName?: string;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name) private auditModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Deja constancia de una acción del panel. Nunca lanza: si falla la auditoría
   * preferimos perder el registro antes que tumbar la operación del admin.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditModel.create({
        actor: new Types.ObjectId(entry.actorId),
        actorName: entry.actorName ?? '',
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary ?? '',
        meta: entry.meta ?? {},
      });
    } catch (e) {
      this.logger.error(`No se pudo auditar ${entry.action}: ${(e as Error).message}`);
    }
  }

  async list(params: {
    page?: number;
    limit?: number;
    entity?: string;
    entityId?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

    const filter: Record<string, unknown> = {};
    if (params.entity) filter.entity = params.entity;
    if (params.entityId) filter.entityId = params.entityId;

    const [items, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'name email')
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }
}
