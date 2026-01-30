import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreditPurchase, CreditPurchaseDocument } from './schemas/credit-purchase.schema';
import { AvatarsService } from '../avatars/avatars.service';

export interface CreateUserDto {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  appleId?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(CreditPurchase.name) private creditPurchaseModel: Model<CreditPurchaseDocument>,
    private avatarsService: AvatarsService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const user = new this.userModel({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      credits: 10,
      googleId: dto.googleId,
      appleId: dto.appleId,
    });
    return user.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.userModel
      .findById(id)
      .populate('avatar', 'name price sprites')
      .exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
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

  async updateCredits(userId: string, delta: number): Promise<UserDocument> {
    const user = await this.getOrThrow(userId);
    user.credits = Math.max(0, user.credits + delta);
    return user.save();
  }

  async setAvatar(userId: string, avatarId: string): Promise<UserDocument> {
    const user = await this.getOrThrow(userId);
    const inCollection = user.collection.some(
      (c) => c.avatar.toString() === avatarId,
    );
    if (!inCollection) {
      throw new NotFoundException('Avatar not in your collection');
    }
    user.avatar = new Types.ObjectId(avatarId) as any;
    return user.save();
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

  async recordCreditPurchase(userId: string, amount: number): Promise<void> {
    await this.creditPurchaseModel.create({ userId, amount });
  }

  async updateStats(
    userId: string,
    result: 'win' | 'draw' | 'lose',
  ): Promise<void> {
    const key = result === 'win' ? 'stats.wins' : result === 'draw' ? 'stats.draws' : 'stats.loses';
    await this.userModel
      .updateOne({ _id: userId }, { $inc: { [key]: 1 } })
      .exec();
  }

  async purchaseCredits(userId: string, amount: number): Promise<{ credits: number }> {
    await this.recordCreditPurchase(userId, amount);
    const user = await this.updateCredits(userId, amount);
    return { credits: user.credits };
  }

  async purchaseAvatar(
    userId: string,
    avatarId: string,
    price: number,
  ): Promise<UserDocument> {
    const user = await this.getOrThrow(userId);
    if (user.credits < price) {
      throw new NotFoundException('Insufficient credits');
    }
    const alreadyOwned = user.collection.some(
      (c) => c.avatar.toString() === avatarId,
    );
    if (alreadyOwned) {
      throw new ConflictException('Avatar already in collection');
    }
    user.credits -= price;
    await user.save();
    await this.addToCollection(userId, avatarId, price);
    return this.getOrThrow(userId);
  }

  async purchaseAvatarById(userId: string, avatarId: string): Promise<UserDocument> {
    const avatar = await this.avatarsService.getOrThrow(avatarId);
    return this.purchaseAvatar(userId, avatarId, avatar.price);
  }
}

