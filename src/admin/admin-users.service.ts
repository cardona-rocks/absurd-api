import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Avatar, AvatarDocument } from '../avatars/schemas/avatar.schema';
import { AuditService } from './audit.service';
import { isEnemyCategory } from '../common/constants/catalog';
import type { Role } from '../common/constants/roles';

interface Actor {
  id: string;
  name: string;
  role: Role;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Avatar.name) private avatarModel: Model<AvatarDocument>,
    private audit: AuditService,
  ) {}

  private async getOrThrow(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('User not found');
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private strip(user: UserDocument) {
    const obj = user.toObject();
    delete (obj as Record<string, unknown>).password;
    return obj;
  }

  async list(params: {
    search?: string;
    role?: string;
    banned?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);

    const filter: Record<string, unknown> = {};
    if (params.role) filter.role = params.role;
    if (params.banned !== undefined) filter.banned = params.banned;
    if (params.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { email: { $regex: params.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('avatar', 'name slug category')
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async detail(id: string) {
    const user = await this.userModel
      .findById(id)
      .select('-password')
      .populate('avatar', 'name slug category')
      .populate('collection.avatar', 'name slug category price')
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Suspende o reactiva una cuenta. */
  async setBanned(
    id: string,
    banned: boolean,
    reason: string | undefined,
    actor: Actor,
  ) {
    const user = await this.getOrThrow(id);

    if (user._id.toString() === actor.id) {
      throw new BadRequestException('No puedes banearte a ti mismo');
    }
    // Un moderador no puede tocar a otro miembro del equipo.
    if (user.role !== 'player' && actor.role !== 'admin') {
      throw new ForbiddenException('Solo un admin puede moderar al equipo');
    }

    user.banned = banned;
    user.bannedReason = banned ? (reason ?? null) : null;
    user.bannedAt = banned ? new Date() : null;
    user.bannedBy = banned ? new Types.ObjectId(actor.id) : null;
    await user.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: banned ? 'user.ban' : 'user.unban',
      entity: 'user',
      entityId: user._id.toString(),
      summary: `${banned ? 'Suspendió' : 'Reactivó'} a ${user.name}`,
      meta: { reason: reason ?? null },
    });

    return this.strip(user);
  }

  /** Cambia el rol. Reservado a admins. */
  async setRole(id: string, role: Role, actor: Actor) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Solo un admin puede cambiar roles');
    }
    const user = await this.getOrThrow(id);

    if (user._id.toString() === actor.id && role !== 'admin') {
      throw new BadRequestException(
        'No puedes quitarte a ti mismo el rol de admin',
      );
    }
    // Evita quedarse sin ningún admin.
    if (user.role === 'admin' && role !== 'admin') {
      const admins = await this.userModel.countDocuments({ role: 'admin' });
      if (admins <= 1) {
        throw new BadRequestException('Debe quedar al menos un administrador');
      }
    }

    const previous = user.role;
    user.role = role;
    await user.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'user.role',
      entity: 'user',
      entityId: user._id.toString(),
      summary: `Cambió el rol de ${user.name}: ${previous} → ${role}`,
      meta: { from: previous, to: role },
    });

    return this.strip(user);
  }

  /** Suma o resta créditos manualmente. */
  async adjustCredits(
    id: string,
    amount: number,
    reason: string | undefined,
    actor: Actor,
  ) {
    if (amount === 0) {
      throw new BadRequestException('El ajuste no puede ser cero');
    }
    const user = await this.getOrThrow(id);
    const before = user.credits;
    user.credits = Math.max(0, user.credits + amount);
    await user.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'user.credits',
      entity: 'user',
      entityId: user._id.toString(),
      summary: `${amount > 0 ? 'Añadió' : 'Quitó'} ${Math.abs(amount)} créditos a ${user.name}`,
      meta: { before, after: user.credits, amount, reason: reason ?? null },
    });

    return this.strip(user);
  }

  /** Regala un avatar sin cobrar créditos. */
  async grantAvatar(id: string, avatarId: string, actor: Actor) {
    const user = await this.getOrThrow(id);
    if (!Types.ObjectId.isValid(avatarId)) {
      throw new NotFoundException('Avatar not found');
    }
    const avatar = await this.avatarModel.findById(avatarId).exec();
    if (!avatar) throw new NotFoundException('Avatar not found');

    // Ni siquiera un admin puede regalar un enemigo: no es jugable y dejaría
    // al jugador con una colección que la app no sabe dibujar.
    if (isEnemyCategory(avatar.category)) {
      throw new BadRequestException('Los enemigos de campaña no son jugables');
    }

    const owned = user.collection.some((c) => c.avatar.toString() === avatarId);
    if (owned) throw new BadRequestException('El jugador ya tiene ese avatar');

    user.collection.push({
      avatar: avatar._id,
      price: 0,
      timestamp: new Date(),
    });
    if (!user.avatar) user.avatar = avatar._id;
    await user.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'user.grantAvatar',
      entity: 'user',
      entityId: user._id.toString(),
      summary: `Regaló "${avatar.name}" a ${user.name}`,
      meta: { avatarId },
    });

    return this.strip(user);
  }

  async setNote(id: string, note: string, actor: Actor) {
    const user = await this.getOrThrow(id);
    user.moderationNote = note;
    await user.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'user.note',
      entity: 'user',
      entityId: user._id.toString(),
      summary: `Actualizó la nota interna de ${user.name}`,
    });

    return this.strip(user);
  }

  /** Restablece la contraseña y obliga a cambiarla al entrar. */
  async resetPassword(id: string, actor: Actor) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException(
        'Solo un admin puede restablecer contraseñas',
      );
    }
    const user = await this.getOrThrow(id);

    // Contraseña temporal legible pero no adivinable.
    const temporary = `absurd-${Math.random().toString(36).slice(2, 10)}`;
    user.password = await bcrypt.hash(temporary, 10);
    user.mustChangePassword = true;
    await user.save();

    await this.audit.record({
      actorId: actor.id,
      actorName: actor.name,
      action: 'user.resetPassword',
      entity: 'user',
      entityId: user._id.toString(),
      summary: `Restableció la contraseña de ${user.name}`,
    });

    // Se devuelve una sola vez: no queda guardada en claro en ningún sitio.
    return { temporaryPassword: temporary };
  }
}
