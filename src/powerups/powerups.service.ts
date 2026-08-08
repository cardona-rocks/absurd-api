import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { POWERUPS, POWERUP_MAP, PowerUpDefinition } from './powerups.catalog';
import { PowerUpId } from '../common/constants/game';

export interface PowerUpView extends PowerUpDefinition {
  owned: number;
  affordable: boolean;
}

@Injectable()
export class PowerUpsService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private async getUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Catálogo con la cantidad que ya posee el usuario. */
  async listForUser(userId: string): Promise<PowerUpView[]> {
    const user = await this.getUser(userId);
    const owned = new Map(
      (user.powerUps ?? []).map((p) => [p.powerUpId, p.quantity]),
    );
    return POWERUPS.map((def) => ({
      ...def,
      owned: owned.get(def.id) ?? 0,
      affordable: user.credits >= def.price,
    }));
  }

  async inventory(userId: string): Promise<Record<string, number>> {
    const user = await this.getUser(userId);
    return Object.fromEntries(
      (user.powerUps ?? []).map((p) => [p.powerUpId, p.quantity]),
    );
  }

  /** Compra una unidad (o varias) de un power up con créditos. */
  async purchase(
    userId: string,
    powerUpId: string,
    quantity = 1,
  ): Promise<{ credits: number; inventory: Record<string, number> }> {
    const def = POWERUP_MAP[powerUpId];
    if (!def) throw new NotFoundException('Power up not found');
    if (quantity < 1 || quantity > 10) {
      throw new BadRequestException('Quantity must be between 1 and 10');
    }

    const user = await this.getUser(userId);
    const cost = def.price * quantity;
    if (user.credits < cost) {
      throw new BadRequestException('No tienes créditos suficientes');
    }

    user.credits -= cost;
    const entry = (user.powerUps ?? []).find((p) => p.powerUpId === def.id);
    if (entry) {
      entry.quantity += quantity;
      entry.updatedAt = new Date();
    } else {
      user.powerUps.push({
        powerUpId: def.id,
        quantity,
        updatedAt: new Date(),
      });
    }
    user.stats.powerUpsBought = (user.stats.powerUpsBought ?? 0) + quantity;
    await user.save();

    return {
      credits: user.credits,
      inventory: Object.fromEntries(
        user.powerUps.map((p) => [p.powerUpId, p.quantity]),
      ),
    };
  }

  /** Descuenta una unidad al usarla en combate. Devuelve false si no tenía. */
  async consume(userId: string, powerUpId: PowerUpId): Promise<boolean> {
    const result = await this.userModel
      .updateOne(
        { _id: userId, powerUps: { $elemMatch: { powerUpId, quantity: { $gt: 0 } } } },
        { $inc: { 'powerUps.$.quantity': -1 } },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  /** Comprueba si el usuario tiene disponible un power up. */
  async has(userId: string, powerUpId: PowerUpId): Promise<boolean> {
    const user = await this.getUser(userId);
    const entry = (user.powerUps ?? []).find((p) => p.powerUpId === powerUpId);
    return (entry?.quantity ?? 0) > 0;
  }
}
