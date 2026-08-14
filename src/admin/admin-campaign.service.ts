import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CampaignLevel,
  CampaignLevelDocument,
} from '../campaign/schemas/campaign-level.schema';
import {
  CampaignRun,
  CampaignRunDocument,
} from '../campaign/schemas/campaign-run.schema';
import { Avatar, AvatarDocument } from '../avatars/schemas/avatar.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuditService } from './audit.service';
import { planRange } from '../campaign/level-plan';
import {
  CYCLE_LENGTH,
  DEFAULT_CYCLE,
  kindForSlot,
} from '../common/constants/campaign';
import { ENEMY_CATEGORY } from '../common/constants/catalog';
import {
  CreateLevelOverrideDto,
  UpdateCampaignLevelDto,
} from './dto/campaign-level.dto';

interface Actor {
  id: string;
  name: string;
}

@Injectable()
export class AdminCampaignService {
  constructor(
    @InjectModel(CampaignLevel.name)
    private levelModel: Model<CampaignLevelDocument>,
    @InjectModel(CampaignRun.name)
    private runModel: Model<CampaignRunDocument>,
    @InjectModel(Avatar.name) private avatarModel: Model<AvatarDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private audit: AuditService,
  ) {}

  /**
   * Todo lo que el panel de campaña necesita de una vez.
   *
   * Devuelve las 20 ranuras del ciclo (creando en memoria las que falten por
   * sembrar, para que la tabla nunca salga con huecos), las excepciones y el
   * bestiario disponible para elegir enemigos.
   */
  async overview() {
    const [saved, enemies] = await Promise.all([
      this.levelModel.find().sort({ level: 1, slot: 1 }).lean().exec(),
      this.avatarModel
        .find({ category: ENEMY_CATEGORY })
        .sort({ 'enemy.class': 1, 'enemy.level': 1 })
        .lean()
        .exec(),
    ]);

    const templates = saved.filter((l) => l.level == null);
    const overrides = saved.filter((l) => l.level != null);

    // Las ranuras sin sembrar se enseñan con los valores de fábrica y marcadas
    // como `seeded: false`, para que el panel sepa que aún no existen en la base.
    const cycle = Array.from({ length: CYCLE_LENGTH }, (_, i) => {
      const slot = i + 1;
      const doc = templates.find((t) => t.slot === slot);
      const fallback = DEFAULT_CYCLE[i];
      return doc
        ? { ...doc, seeded: true }
        : {
            _id: null,
            slot,
            level: null,
            name: fallback.name,
            kind: fallback.kind,
            enemyClass: fallback.enemyClass,
            enemyCount: fallback.enemyCount,
            heartsPerEnemy: fallback.heartsPerEnemy,
            heartsPerEnemyAlt: fallback.heartsPerEnemyAlt,
            playerHearts: fallback.playerHearts,
            enemies: [],
            enabled: true,
            notes: '',
            seeded: false,
          };
    });

    const byClass = { Basic: 0, Elite: 0, Boss: 0 };
    for (const e of enemies) {
      const cls = e.enemy?.class ?? 'Basic';
      byClass[cls] = (byClass[cls] ?? 0) + 1;
    }

    return {
      cycleLength: CYCLE_LENGTH,
      cycle,
      overrides,
      enemies: enemies.map((e) => ({
        _id: String(e._id),
        name: e.name,
        slug: e.slug,
        class: e.enemy?.class ?? 'Basic',
        level: e.enemy?.level ?? 1,
        hearts: e.enemy?.hearts ?? 3,
        counterRate: e.enemy?.counterRate ?? null,
        retired: e.retired,
        // Sin imagen de frente el enemigo sale con la ilustración de reserva.
        ready: (e.sprites?.front?.length ?? 0) > 0,
      })),
      enemyCounts: byClass,
      /** Avisos que el panel enseña arriba del todo. */
      warnings: this.warningsFor(byClass, enemies.length),
    };
  }

  private warningsFor(
    byClass: Record<string, number>,
    total: number,
  ): string[] {
    const out: string[] = [];
    if (!total) {
      out.push(
        'No hay ningún enemigo. Ejecuta `npm run seed:campaign` o créalos aquí: sin enemigos la campaña no puede empezar.',
      );
      return out;
    }
    for (const [cls, label] of [
      ['Basic', 'comunes'],
      ['Elite', 'de élite'],
      ['Boss', 'jefes'],
    ] as const) {
      if (!byClass[cls]) {
        out.push(
          `No hay enemigos ${label}: los niveles que los piden fallarán al empezar.`,
        );
      }
    }
    return out;
  }

  /** Simulación de niveles, para comprobar de un vistazo qué sale en cada uno. */
  async preview(from: number, count: number) {
    const configs = await this.levelModel.find().lean().exec();
    return planRange(from, Math.min(Math.max(count, 1), 60), configs);
  }

  // ------------------------------------------------------- ranuras del ciclo

  /**
   * Guarda una ranura del ciclo. Si aún no existía en la base, se crea.
   *
   * Así el panel puede editar las 20 ranuras aunque no se haya pasado la
   * siembra: la primera edición la materializa.
   */
  async saveSlot(
    slot: number,
    dto: UpdateCampaignLevelDto,
    actor: Actor,
  ): Promise<CampaignLevelDocument> {
    if (slot < 1 || slot > CYCLE_LENGTH) {
      throw new BadRequestException(
        `La ranura tiene que estar entre 1 y ${CYCLE_LENGTH}`,
      );
    }
    await this.assertEnemiesExist(dto.enemies);

    const fallback = DEFAULT_CYCLE[slot - 1];
    const existing = await this.levelModel
      .findOne({ slot, level: null })
      .exec();

    const doc =
      existing ??
      new this.levelModel({
        slot,
        level: null,
        name: fallback.name,
        kind: fallback.kind,
        enemyClass: fallback.enemyClass,
        enemyCount: fallback.enemyCount,
        heartsPerEnemy: fallback.heartsPerEnemy,
        heartsPerEnemyAlt: fallback.heartsPerEnemyAlt,
        playerHearts: fallback.playerHearts,
      });

    const before = this.summary(doc);
    this.apply(doc, dto);
    await doc.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'campaign.slot.update',
      entity: 'campaignLevel',
      entityId: doc._id.toString(),
      summary: `Editó la ranura ${slot} del ciclo (niveles ${slot}, ${slot + CYCLE_LENGTH}, ${slot + CYCLE_LENGTH * 2}…)`,
      meta: { before, after: this.summary(doc) },
    });

    return doc;
  }

  /** Devuelve una ranura a los valores de fábrica. */
  async resetSlot(slot: number, actor: Actor): Promise<CampaignLevelDocument> {
    const fallback = DEFAULT_CYCLE[slot - 1];
    if (!fallback) throw new NotFoundException('Esa ranura no existe');

    return this.saveSlot(
      slot,
      {
        name: fallback.name,
        kind: fallback.kind,
        enemyClass: fallback.enemyClass,
        enemyCount: fallback.enemyCount,
        heartsPerEnemy: fallback.heartsPerEnemy,
        heartsPerEnemyAlt: fallback.heartsPerEnemyAlt,
        playerHearts: fallback.playerHearts,
        enemies: [],
        enabled: true,
      },
      actor,
    );
  }

  // ---------------------------------------------------------- excepciones

  async createOverride(
    dto: CreateLevelOverrideDto,
    actor: Actor,
  ): Promise<CampaignLevelDocument> {
    const clash = await this.levelModel.exists({ level: dto.level });
    if (clash) {
      throw new ConflictException(
        `Ya hay una excepción para el nivel ${dto.level}`,
      );
    }
    await this.assertEnemiesExist(dto.enemies);

    const slot = ((dto.level - 1) % CYCLE_LENGTH) + 1;
    const doc = new this.levelModel({
      slot,
      level: dto.level,
      kind: dto.kind ?? kindForSlot(slot),
    });
    this.apply(doc, dto);
    await doc.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'campaign.override.create',
      entity: 'campaignLevel',
      entityId: doc._id.toString(),
      summary: `Creó una excepción para el nivel ${dto.level}`,
      meta: this.summary(doc),
    });

    return doc;
  }

  async updateOverride(
    id: string,
    dto: UpdateCampaignLevelDto,
    actor: Actor,
  ): Promise<CampaignLevelDocument> {
    const doc = await this.getLevel(id);
    if (doc.level == null) {
      throw new BadRequestException(
        'Eso es una ranura del ciclo, no una excepción. Edítala desde el ciclo.',
      );
    }
    await this.assertEnemiesExist(dto.enemies);

    const before = this.summary(doc);
    this.apply(doc, dto);
    await doc.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'campaign.override.update',
      entity: 'campaignLevel',
      entityId: doc._id.toString(),
      summary: `Editó la excepción del nivel ${doc.level}`,
      meta: { before, after: this.summary(doc) },
    });

    return doc;
  }

  async removeOverride(id: string, actor: Actor) {
    const doc = await this.getLevel(id);
    if (doc.level == null) {
      throw new BadRequestException(
        'Las ranuras del ciclo no se borran; se devuelven a sus valores de fábrica.',
      );
    }
    await doc.deleteOne();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'campaign.override.delete',
      entity: 'campaignLevel',
      entityId: id,
      summary: `Borró la excepción del nivel ${doc.level}`,
      meta: {},
    });

    return { deleted: true, level: doc.level };
  }

  // ------------------------------------------------------------- ayudantes

  private async getLevel(id: string): Promise<CampaignLevelDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Ese nivel no existe');
    }
    const doc = await this.levelModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Ese nivel no existe');
    return doc;
  }

  /**
   * Los enemigos fijados a mano tienen que existir y ser enemigos de verdad.
   *
   * Sin esto se podría clavar un avatar jugable en un nivel y la campaña
   * sacaría a pelear al León contra el jugador.
   */
  private async assertEnemiesExist(ids?: string[]): Promise<void> {
    if (!ids?.length) return;
    const found = await this.avatarModel
      .find({ _id: { $in: ids }, category: ENEMY_CATEGORY })
      .select('_id')
      .lean()
      .exec();

    if (found.length !== new Set(ids).size) {
      throw new BadRequestException(
        'Alguno de los enemigos elegidos no existe o no es de categoría Enemy.',
      );
    }
  }

  private apply(doc: CampaignLevelDocument, dto: UpdateCampaignLevelDto): void {
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.kind !== undefined) doc.kind = dto.kind;
    if (dto.enemyClass !== undefined) doc.enemyClass = dto.enemyClass;
    if (dto.enemyCount !== undefined) doc.enemyCount = dto.enemyCount;
    if (dto.heartsPerEnemy !== undefined)
      doc.heartsPerEnemy = dto.heartsPerEnemy;
    if (dto.heartsPerEnemyAlt !== undefined) {
      doc.heartsPerEnemyAlt = dto.heartsPerEnemyAlt;
    }
    if (dto.playerHearts !== undefined) doc.playerHearts = dto.playerHearts;
    if (dto.enemies !== undefined) {
      doc.enemies = dto.enemies.map((e) => new Types.ObjectId(e));
    }
    if (dto.enabled !== undefined) doc.enabled = dto.enabled;
    if (dto.notes !== undefined) doc.notes = dto.notes;
  }

  private summary(doc: CampaignLevelDocument) {
    return {
      name: doc.name,
      kind: doc.kind,
      enemyClass: doc.enemyClass,
      enemyCount: doc.enemyCount,
      heartsPerEnemy: [...(doc.heartsPerEnemy ?? [])],
      playerHearts: doc.playerHearts,
      enemies: (doc.enemies ?? []).map((e) => e.toString()),
    };
  }

  // ------------------------------------------------------------ estadísticas

  /** Cómo le va a la gente en la campaña: hasta dónde llegan y dónde se atascan. */
  async stats() {
    const [progress, byLevel, recent] = await Promise.all([
      this.userModel.aggregate<{
        _id: null;
        players: number;
        avgLevel: number;
        maxLevel: number;
      }>([
        { $match: { 'campaign.cleared': { $gt: 0 } } },
        {
          $group: {
            _id: null,
            players: { $sum: 1 },
            avgLevel: { $avg: '$campaign.level' },
            maxLevel: { $max: '$campaign.bestLevel' },
          },
        },
      ]),
      // Dónde se pierde más: candidatos a estar mal equilibrados.
      this.runModel.aggregate<{
        _id: number;
        attempts: number;
        wins: number;
      }>([
        { $match: { status: 'Complete' } },
        {
          $group: {
            _id: '$level',
            attempts: { $sum: 1 },
            wins: { $sum: { $cond: ['$won', 1, 0] } },
          },
        },
        { $sort: { attempts: -1 } },
        { $limit: 20 },
      ]),
      this.runModel
        .find({ status: 'Complete' })
        .sort({ finishedAt: -1 })
        .limit(10)
        .populate('userId', 'name')
        .lean()
        .exec(),
    ]);

    return {
      players: progress[0]?.players ?? 0,
      averageLevel: Math.round((progress[0]?.avgLevel ?? 1) * 10) / 10,
      highestLevel: progress[0]?.maxLevel ?? 1,
      levels: byLevel
        .map((l) => ({
          level: l._id,
          attempts: l.attempts,
          wins: l.wins,
          winRate: l.attempts ? Math.round((l.wins / l.attempts) * 100) : 0,
        }))
        .sort((a, b) => a.level - b.level),
      recent,
    };
  }
}
