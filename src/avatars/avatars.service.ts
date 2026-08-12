import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Avatar, AvatarDocument } from './schemas/avatar.schema';

@Injectable()
export class AvatarsService {
  constructor(
    @InjectModel(Avatar.name) private avatarModel: Model<AvatarDocument>,
  ) {}

  /**
   * Catálogo visible para los jugadores.
   *
   * Los ocultos no se listan nunca. Los retirados sí, porque quien ya los tiene
   * debe poder verlos en su colección; la compra se bloquea aparte.
   */
  async findAll(): Promise<AvatarDocument[]> {
    return this.avatarModel.find({ hidden: false }).sort({ order: 1 }).exec();
  }

  async findById(id: string): Promise<AvatarDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.avatarModel.findById(id).exec();
  }

  async findBySlug(slug: string): Promise<AvatarDocument | null> {
    return this.avatarModel.findOne({ slug: slug.toLowerCase() }).exec();
  }

  async getOrThrow(id: string): Promise<AvatarDocument> {
    const avatar = await this.findById(id);
    if (!avatar) throw new NotFoundException('Avatar not found');
    return avatar;
  }

  async create(data: Partial<Avatar>): Promise<AvatarDocument> {
    const avatar = new this.avatarModel(data);
    return avatar.save();
  }
}
