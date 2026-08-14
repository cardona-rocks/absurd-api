import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import {
  CreditPurchase,
  CreditPurchaseDocument,
} from './schemas/credit-purchase.schema';
import { AvatarsService } from '../avatars/avatars.service';
import { SIGNUP_CREDITS } from '../common/constants/game';
import { isEnemyCategory } from '../common/constants/catalog';

export interface CreateUserDto {
  name: string;
  email: string;
  password?: string;
  age?: number | null;
  googleId?: string;
  appleId?: string;
  isGuest?: boolean;
}

export interface MatchResult {
  result: 'win' | 'draw' | 'lose';
  credits: number;
  roundsWon: number;
  roundsLost: number;
  roundDraws: number;
  perfect: boolean;
}

/** Día actual en UTC como YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b) - Date.parse(a);
  return Math.round(ms / 86_400_000);
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(CreditPurchase.name)
    private creditPurchaseModel: Model<CreditPurchaseDocument>,
    private avatarsService: AvatarsService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const user = new this.userModel({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password: dto.password,
      age: dto.age ?? null,
      credits: SIGNUP_CREDITS,
      googleId: dto.googleId,
      appleId: dto.appleId,
      isGuest: dto.isGuest ?? false,
    });
    return user.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.userModel
      .findById(id)
      .populate(
        'avatar',
        'name slug price category description tagline ability sprites',
      )
      .populate('collection.avatar', 'name slug price category sprites')
      .exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Documento con el hash de contraseña incluido, para comparar o cambiarla.
   * El resto de consultas lo omiten al serializar con `toResponse`.
   */
  async getWithPassword(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.userModel.findById(id).exec();
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findByAppleId(appleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ appleId }).exec();
  }

  async updateGoogleId(userId: string, googleId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { googleId }).exec();
  }

  async updateAppleId(userId: string, appleId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { appleId }).exec();
  }

  async getOrThrow(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  toResponse(user: UserDocument) {
    const obj = user.toObject();
    delete (obj as Record<string, unknown>).password;
    return obj;
  }

  // ------------------------------------------------------------- créditos

  async updateCredits(userId: string, delta: number): Promise<UserDocument> {
    const user = await this.getOrThrow(userId);
    user.credits = Math.max(0, user.credits + delta);
    return user.save();
  }

  async recordCreditPurchase(userId: string, amount: number): Promise<void> {
    await this.creditPurchaseModel.create({ userId, amount });
  }

  async purchaseCredits(
    userId: string,
    amount: number,
  ): Promise<{ credits: number }> {
    await this.recordCreditPurchase(userId, amount);
    const user = await this.updateCredits(userId, amount);
    return { credits: user.credits };
  }

  async creditHistory(userId: string) {
    return this.creditPurchaseModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  // -------------------------------------------------------------- avatares

  async setAvatar(userId: string, avatarId: string): Promise<UserDocument> {
    const user = await this.getOrThrow(userId);

    // Cinturón y tirantes: un enemigo no debería estar en ninguna colección,
    // pero si alguno se colara por un arreglo manual, aquí se para.
    const avatar = await this.avatarsService.findById(avatarId);
    if (avatar && isEnemyCategory(avatar.category)) {
      throw new BadRequestException('Ese avatar no es jugable');
    }

    const inCollection = user.collection.some((c) => {
      const id =
        c.avatar instanceof Types.ObjectId
          ? c.avatar.toString()
          : (c.avatar as unknown as { _id: Types.ObjectId })?._id?.toString();
      return id === avatarId;
    });
    if (!inCollection) {
      throw new BadRequestException('Ese avatar no está en tu colección');
    }
    user.avatar = new Types.ObjectId(avatarId);
    await user.save();
    return this.getOrThrow(userId);
  }

  async addToCollection(
    userId: string,
    avatarId: string,
    price: number,
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        {
          $push: {
            collection: {
              avatar: new Types.ObjectId(avatarId),
              price,
              timestamp: new Date(),
            },
          },
        },
      )
      .exec();
  }

  async purchaseAvatarById(
    userId: string,
    avatarId: string,
  ): Promise<UserDocument> {
    const avatar = await this.avatarsService.getOrThrow(avatarId);
    const user = await this.getOrThrow(userId);

    // Los enemigos son del sistema: no tienen precio ni se coleccionan.
    if (isEnemyCategory(avatar.category)) {
      throw new BadRequestException('Ese avatar no está a la venta');
    }

    // Los ocultos y los retirados no se venden, aunque se sepa el id.
    if (avatar.hidden || avatar.retired) {
      throw new BadRequestException('Ese avatar no está a la venta');
    }

    const alreadyOwned = user.collection.some((c) => {
      const id =
        c.avatar instanceof Types.ObjectId
          ? c.avatar.toString()
          : (c.avatar as unknown as { _id: Types.ObjectId })?._id?.toString();
      return id === avatarId;
    });
    if (alreadyOwned) {
      throw new ConflictException('Ya tienes ese avatar');
    }
    if (user.credits < avatar.price) {
      throw new BadRequestException('No tienes créditos suficientes');
    }

    user.credits -= avatar.price;
    // El primer avatar comprado se selecciona automáticamente.
    if (!user.avatar) user.avatar = avatar._id;
    await user.save();
    await this.addToCollection(userId, avatarId, avatar.price);
    return this.getOrThrow(userId);
  }

  // -------------------------------------------------------------- campaña

  /**
   * Aplica el resultado de un nivel de campaña.
   *
   * Sólo desbloquea el siguiente nivel si se ganó el que tocaba avanzar: se
   * puede repetir un nivel viejo cuantas veces se quiera sin que el progreso
   * se mueva. El récord de PvP (`stats.wins`/`loses`) no se toca nunca desde
   * aquí; lo único compartido es el monedero y los créditos ganados.
   */
  async applyCampaignResult(
    userId: string,
    r: { level: number; won: boolean; credits: number },
  ): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) return;

    const c = user.campaign;
    if (r.won) {
      c.wins += 1;
      c.cleared += 1;
      // Avanza sólo si acaba de superar su frontera.
      if (r.level >= c.level) c.level = r.level + 1;
      c.bestLevel = Math.max(c.bestLevel, r.level);
    } else {
      c.loses += 1;
    }
    c.lastPlayedAt = new Date();

    if (r.credits > 0) {
      user.credits += r.credits;
      user.stats.creditsEarned += r.credits;
    }

    await user.save();
  }

  // ---------------------------------------------------------- estadísticas

  /** Aplica el resultado de un combate: stats, créditos y racha de victorias. */
  async applyMatchResult(userId: string, r: MatchResult): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) return;

    const stats = user.stats;
    if (r.result === 'win') stats.wins += 1;
    else if (r.result === 'draw') stats.draws += 1;
    else stats.loses += 1;

    stats.matchesPlayed += 1;
    stats.roundsWon += r.roundsWon;
    stats.roundsLost += r.roundsLost;
    stats.roundDraws += r.roundDraws;
    if (r.perfect) stats.perfectWins += 1;
    stats.creditsEarned += r.credits;

    user.credits += r.credits;

    if (r.result === 'win') {
      user.streak.currentWins += 1;
      user.streak.bestWins = Math.max(
        user.streak.bestWins,
        user.streak.currentWins,
      );
    } else if (r.result === 'lose') {
      user.streak.currentWins = 0;
    }

    await user.save();
  }

  /** Marca la conexión de hoy y actualiza la racha de días seguidos. */
  async touchLoginStreak(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) return;

    const day = today();
    const last = user.streak.lastLoginDay;
    if (last === day) return;

    if (last && daysBetween(last, day) === 1) {
      user.streak.currentLoginDays += 1;
    } else {
      user.streak.currentLoginDays = 1;
    }
    user.streak.bestLoginDays = Math.max(
      user.streak.bestLoginDays,
      user.streak.currentLoginDays,
    );
    user.streak.lastLoginDay = day;
    await user.save();
  }
}
