import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Avatar, AvatarDocument } from '../avatars/schemas/avatar.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UploadsService } from '../uploads/uploads.service';
import type { UploadedFile } from '../uploads/uploads.service';
import { AuditService } from './audit.service';
import {
  REQUIRED_SPRITE_TYPES,
  SPRITE_TYPES,
  SPRITE_LABELS,
} from '../common/constants/catalog';
import type { SpriteType } from '../common/constants/catalog';
import { CreateAvatarDto, UpdateAvatarDto } from './dto/avatar.dto';
import { uniqueSlug } from '../common/slug';

interface Actor {
  id: string;
  name: string;
}

@Injectable()
export class AdminAvatarsService {
  private readonly logger = new Logger(AdminAvatarsService.name);

  constructor(
    @InjectModel(Avatar.name) private avatarModel: Model<AvatarDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private uploads: UploadsService,
    private audit: AuditService,
  ) {}

  /**
   * Un avatar necesita al menos una imagen de frente y otra de espaldas para
   * poder dibujarse en combate. Se comprueba al publicar, no al crear, para
   * poder guardar borradores mientras se suben las imágenes.
   */
  private assertPublishable(avatar: AvatarDocument): void {
    const missing = REQUIRED_SPRITE_TYPES.filter(
      (t) => (avatar.sprites?.[t]?.length ?? 0) === 0,
    );
    if (missing.length) {
      throw new BadRequestException(
        `Faltan imágenes obligatorias: ${missing.map((m) => SPRITE_LABELS[m]).join(' y ')}.`,
      );
    }
  }

  async list(params: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

    const filter: Record<string, unknown> = {};
    if (params.category) filter.category = params.category;
    if (params.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { slug: { $regex: params.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.avatarModel
        .find(filter)
        .sort({ order: 1, createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.avatarModel.countDocuments(filter).exec(),
    ]);

    // Cuántos jugadores tienen cada avatar, para saber qué se puede borrar.
    const counts = await this.ownershipCounts(items.map((a) => a._id));

    return {
      items: items.map((a) => ({
        ...a.toObject(),
        ownedBy: counts.get(a._id.toString()) ?? 0,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  private async ownershipCounts(
    ids: Types.ObjectId[],
  ): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.userModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $unwind: '$collection' },
      { $match: { 'collection.avatar': { $in: ids } } },
      { $group: { _id: '$collection.avatar', n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), r.n]));
  }

  /**
   * Comprueba que el tipo de sprite existe y deja el contenedor listo.
   *
   * Sin esto, un tipo mal escrito escribiría en una propiedad inexistente, y un
   * avatar antiguo sin el objeto `sprites` reventaba con un 500 al asignarle.
   */
  private spriteBucket(avatar: AvatarDocument, type: SpriteType): void {
    if (!SPRITE_TYPES.includes(type)) {
      throw new BadRequestException(
        `Tipo de sprite desconocido: "${type}". Usa uno de: ${SPRITE_TYPES.join(', ')}.`,
      );
    }
    if (!avatar.sprites) {
      avatar.sprites = {
        front: [],
        back: [],
        default: [],
        win: [],
        lose: [],
      } as never;
    }
  }

  /**
   * Garantiza que el avatar tiene slug antes de guardarlo.
   *
   * Los avatares creados antes de que existiera el campo no lo tienen, y el
   * esquema lo exige: sin esto, subir una imagen a uno de ellos falla con
   * "Path `slug` is required". Lo correcto es pasar `npm run migrate:avatars`,
   * pero aquí se rellena igualmente para no bloquear al administrador.
   */
  private async ensureSlug(avatar: AvatarDocument): Promise<void> {
    if (avatar.slug) return;

    const others = await this.avatarModel
      .find({ slug: { $exists: true, $ne: null } })
      .select('slug')
      .lean()
      .exec();
    const taken = new Set(
      others.map((o) => o.slug).filter((x): x is string => Boolean(x)),
    );

    avatar.slug = uniqueSlug(avatar.name ?? '', taken);
    this.logger.warn(
      `El avatar ${avatar._id.toString()} no tenía slug; se le asignó "${avatar.slug}". ` +
        'Pasa `npm run migrate:avatars` para arreglar los demás.',
    );
  }

  async get(id: string): Promise<AvatarDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Avatar not found');
    const avatar = await this.avatarModel.findById(id).exec();
    if (!avatar) throw new NotFoundException('Avatar not found');
    return avatar;
  }

  async create(dto: CreateAvatarDto, actor: Actor): Promise<AvatarDocument> {
    const exists = await this.avatarModel.exists({ slug: dto.slug });
    if (exists) throw new ConflictException('Ya existe un avatar con ese slug');

    const created = await this.avatarModel.create({
      ...dto,
      sprites: dto.sprites ?? {},
    });

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'avatar.create',
      entity: 'avatar',
      entityId: created._id.toString(),
      summary: `Creó el avatar "${created.name}"`,
      meta: { category: created.category, price: created.price },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateAvatarDto,
    actor: Actor,
  ): Promise<AvatarDocument> {
    const avatar = await this.get(id);

    if (dto.slug && dto.slug !== avatar.slug) {
      const clash = await this.avatarModel.exists({
        slug: dto.slug,
        _id: { $ne: avatar._id },
      });
      if (clash) throw new ConflictException('Ya existe un avatar con ese slug');
    }

    const before = {
      name: avatar.name,
      category: avatar.category,
      price: avatar.price,
      hidden: avatar.hidden,
      retired: avatar.retired,
    };

    Object.assign(avatar, dto);
    if (dto.sprites) {
      // Se reemplaza cada tipo entero: el panel manda siempre la lista completa.
      for (const type of SPRITE_TYPES) {
        const next = dto.sprites[type];
        if (next) avatar.sprites[type] = next as never;
      }
    }

    // Si está visible en tienda tiene que poder dibujarse.
    if (!avatar.hidden) this.assertPublishable(avatar);

    await this.ensureSlug(avatar);
    await avatar.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'avatar.update',
      entity: 'avatar',
      entityId: avatar._id.toString(),
      summary: `Editó el avatar "${avatar.name}"`,
      meta: {
        before,
        after: {
          name: avatar.name,
          category: avatar.category,
          price: avatar.price,
          hidden: avatar.hidden,
          retired: avatar.retired,
        },
      },
    });

    return avatar;
  }

  /** Añade imágenes a un tipo de sprite. */
  async addSprites(
    id: string,
    type: SpriteType,
    files: UploadedFile[],
    actor: Actor,
  ): Promise<AvatarDocument> {
    const avatar = await this.get(id);
    this.spriteBucket(avatar, type);
    const stored = await this.uploads.register(files);

    const current = avatar.sprites[type] ?? [];
    const startOrder = current.length;
    avatar.sprites[type] = [
      ...current,
      ...stored.map((s, i) => ({
        ...s,
        order: startOrder + i,
        uploadedAt: new Date(),
      })),
    ] as never;

    await this.ensureSlug(avatar);
    await avatar.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'avatar.sprites.add',
      entity: 'avatar',
      entityId: avatar._id.toString(),
      summary: `Subió ${stored.length} imagen(es) de ${SPRITE_LABELS[type]} a "${avatar.name}"`,
      meta: { type, files: stored.map((s) => s.filename) },
    });

    return avatar;
  }

  /** Quita una imagen de un tipo de sprite y borra el fichero del disco. */
  async removeSprite(
    id: string,
    type: SpriteType,
    filename: string,
    actor: Actor,
  ): Promise<AvatarDocument> {
    const avatar = await this.get(id);
    this.spriteBucket(avatar, type);
    const current = avatar.sprites[type] ?? [];
    const target = current.find((s) => s.filename === filename);
    if (!target) throw new NotFoundException('Esa imagen no está en el avatar');

    const remaining = current.filter((s) => s.filename !== filename);
    if (
      !avatar.hidden &&
      REQUIRED_SPRITE_TYPES.includes(type) &&
      remaining.length === 0
    ) {
      throw new BadRequestException(
        `${SPRITE_LABELS[type]} necesita al menos una imagen mientras el avatar esté visible.`,
      );
    }

    avatar.sprites[type] = remaining.map((s, i) => ({
      ...s,
      order: i,
    })) as never;
    await this.ensureSlug(avatar);
    await avatar.save();
    await this.uploads.removeByFilename(filename);

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'avatar.sprites.remove',
      entity: 'avatar',
      entityId: avatar._id.toString(),
      summary: `Borró una imagen de ${SPRITE_LABELS[type]} de "${avatar.name}"`,
      meta: { type, filename },
    });

    return avatar;
  }

  /** Reordena las imágenes de un tipo según la lista de nombres recibida. */
  async reorderSprites(
    id: string,
    type: SpriteType,
    filenames: string[],
  ): Promise<AvatarDocument> {
    const avatar = await this.get(id);
    this.spriteBucket(avatar, type);
    const current = avatar.sprites[type] ?? [];
    const byName = new Map(current.map((s) => [s.filename, s]));

    const ordered = filenames
      .map((f) => byName.get(f))
      .filter((s): s is (typeof current)[number] => Boolean(s));
    if (ordered.length !== current.length) {
      throw new BadRequestException(
        'La lista de orden no coincide con las imágenes guardadas',
      );
    }

    avatar.sprites[type] = ordered.map((s, i) => ({ ...s, order: i })) as never;
    await this.ensureSlug(avatar);
    await avatar.save();
    return avatar;
  }

  /**
   * Borra un avatar. Se bloquea si algún jugador lo tiene comprado: en ese caso
   * lo correcto es retirarlo, no borrarlo, o quedarían colecciones rotas.
   */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    const avatar = await this.get(id);

    const owners = await this.userModel.countDocuments({
      'collection.avatar': avatar._id,
    });
    if (owners > 0) {
      throw new ConflictException(
        `${owners} jugador(es) tienen este avatar. Márcalo como retirado en vez de borrarlo.`,
      );
    }

    for (const type of SPRITE_TYPES) {
      for (const sprite of avatar.sprites[type] ?? []) {
        await this.uploads.removeByFilename(sprite.filename);
      }
    }
    await avatar.deleteOne();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'avatar.delete',
      entity: 'avatar',
      entityId: id,
      summary: `Borró el avatar "${avatar.name}"`,
    });

    return { deleted: true };
  }
}
