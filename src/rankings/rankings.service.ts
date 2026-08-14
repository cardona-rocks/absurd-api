import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';

export interface RankingEntry {
  rank: number;
  userId: string;
  name: string;
  wins: number;
  loses: number;
  draws: number;
  matchesPlayed: number;
  winRate: number;
  avatar: { _id: string; name: string; slug: string; sprites?: unknown } | null;
  isMe: boolean;
}

@Injectable()
export class RankingsService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private toEntry(
    user: UserDocument,
    rank: number,
    meId: string,
  ): RankingEntry {
    const stats = user.stats ?? ({} as UserDocument['stats']);
    const played = stats.matchesPlayed ?? 0;
    const avatar = user.avatar as unknown as
      | { _id: Types.ObjectId; name: string; slug: string; sprites?: unknown }
      | null;
    return {
      rank,
      userId: user._id.toString(),
      name: user.name,
      wins: stats.wins ?? 0,
      loses: stats.loses ?? 0,
      draws: stats.draws ?? 0,
      matchesPlayed: played,
      winRate: played > 0 ? Math.round(((stats.wins ?? 0) / played) * 100) : 0,
      avatar: avatar?._id
        ? {
            _id: avatar._id.toString(),
            name: avatar.name,
            slug: avatar.slug,
            sprites: avatar.sprites,
          }
        : null,
      isMe: user._id.toString() === meId,
    };
  }

  /** Tabla global ordenada por victorias, desempatando por menos derrotas. */
  async leaderboard(
    meId: string,
    limit = 50,
  ): Promise<{ top: RankingEntry[]; me: RankingEntry | null }> {
    const capped = Math.min(Math.max(limit, 1), 100);
    const users = await this.userModel
      .find({ isGuest: false })
      .sort({ 'stats.wins': -1, 'stats.loses': 1, createdAt: 1 })
      .limit(capped)
      .populate('avatar', 'name slug category sprites')
      .exec();

    const top = users.map((u, i) => this.toEntry(u, i + 1, meId));

    const inTop = top.find((e) => e.isMe);
    if (inTop) return { top, me: inTop };

    // El usuario no entró en el top: calculamos su posición real.
    const me = await this.userModel
      .findById(meId)
      .populate('avatar', 'name slug')
      .exec();
    if (!me) return { top, me: null };

    const better = await this.userModel
      .countDocuments({
        isGuest: false,
        $or: [
          { 'stats.wins': { $gt: me.stats?.wins ?? 0 } },
          {
            'stats.wins': me.stats?.wins ?? 0,
            'stats.loses': { $lt: me.stats?.loses ?? 0 },
          },
        ],
      })
      .exec();

    return { top, me: this.toEntry(me, better + 1, meId) };
  }
}
