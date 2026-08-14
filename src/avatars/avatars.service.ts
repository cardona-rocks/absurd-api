import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Avatar, AvatarDocument } from './schemas/avatar.schema';
import { ENEMY_CATEGORY } from '../common/constants/catalog';
import type { EnemyClass } from '../common/constants/catalog';

@Injectable()
export class AvatarsService {
  constructor(
    @InjectModel(Avatar.name) private avatarModel: Model<AvatarDocument>,
  ) {}

  /**
   * Catálogo visible para los jugadores.
   *
   * Los ocultos no se listan nunca. Los retirados sí, porque quien ya los tiene
   * debe poder verlos en su colección; la compra se bloquea aparte. Los
   * enemigos quedan fuera siempre: son del sistema, no de la tienda.
   */
  async findAll(): Promise<AvatarDocument[]> {
    return this.avatarModel
      .find({ hidden: false, category: { $ne: ENEMY_CATEGORY } })
      .sort({ order: 1 })
      .exec();
  }

  /**
   * Enemigos de una clase, ordenados por cercanía al nivel pedido.
   *
   * Así los primeros niveles sacan a las criaturas más flojas y los ciclos
   * avanzados van estrenando bestiario sin necesidad de tocar la plantilla.
   */
  async findEnemies(
    enemyClass: EnemyClass,
    level: number,
  ): Promise<AvatarDocument[]> {
    const enemies = await this.avatarModel
      .find({
        category: ENEMY_CATEGORY,
        'enemy.class': enemyClass,
        retired: false,
      })
      .exec();

    return enemies.sort(
      (a, b) =>
        Math.abs((a.enemy?.level ?? 1) - level) -
          Math.abs((b.enemy?.level ?? 1) - level) ||
        (a.enemy?.level ?? 1) - (b.enemy?.level ?? 1),
    );
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
