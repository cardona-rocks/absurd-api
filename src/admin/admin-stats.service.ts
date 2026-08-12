import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Avatar, AvatarDocument } from '../avatars/schemas/avatar.schema';
import { Match, MatchDocument } from '../matches/schemas/match.schema';
import {
  Tournament,
  TournamentDocument,
} from '../tournaments/schemas/tournament.schema';

@Injectable()
export class AdminStatsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Avatar.name) private avatarModel: Model<AvatarDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(Tournament.name)
    private tournamentModel: Model<TournamentDocument>,
  ) {}

  /** Cifras de cabecera del panel. */
  async overview() {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      users,
      guests,
      banned,
      newThisWeek,
      avatars,
      hiddenAvatars,
      matchesTotal,
      matchesToday,
      liveMatches,
      searching,
      tournaments,
      creditsAgg,
    ] = await Promise.all([
      this.userModel.countDocuments({ isGuest: false }),
      this.userModel.countDocuments({ isGuest: true }),
      this.userModel.countDocuments({ banned: true }),
      this.userModel.countDocuments({ createdAt: { $gte: weekAgo } }),
      this.avatarModel.countDocuments(),
      this.avatarModel.countDocuments({ hidden: true }),
      this.matchModel.countDocuments({ status: 'Complete' }),
      this.matchModel.countDocuments({
        status: 'Complete',
        finishedAt: { $gte: dayAgo },
      }),
      this.matchModel.countDocuments({ status: 'In progress' }),
      this.matchModel.countDocuments({ status: 'Searching' }),
      this.tournamentModel.countDocuments({
        status: { $in: ['Open', 'In progress'] },
      }),
      this.userModel.aggregate<{ _id: null; total: number }>([
        { $group: { _id: null, total: { $sum: '$credits' } } },
      ]),
    ]);

    return {
      users: { total: users, guests, banned, newThisWeek },
      avatars: { total: avatars, hidden: hiddenAvatars },
      matches: {
        total: matchesTotal,
        today: matchesToday,
        live: liveMatches,
        searching,
      },
      tournaments: { active: tournaments },
      economy: { creditsInCirculation: creditsAgg[0]?.total ?? 0 },
    };
  }

  /** Combates por día de la última quincena, para el gráfico del panel. */
  async matchesTimeline(days = 14) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await this.matchModel.aggregate<{ _id: string; n: number }>([
      { $match: { status: 'Complete', finishedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$finishedAt' } },
          n: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Rellena los días sin combates para que la serie no tenga huecos.
    const byDay = new Map(rows.map((r) => [r._id, r.n]));
    const out: { date: string; matches: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, matches: byDay.get(key) ?? 0 });
    }
    return out;
  }

  /** Avatares más comprados. */
  async topAvatars(limit = 10) {
    return this.userModel.aggregate([
      { $unwind: '$collection' },
      { $group: { _id: '$collection.avatar', purchases: { $sum: 1 } } },
      { $sort: { purchases: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'avatars',
          localField: '_id',
          foreignField: '_id',
          as: 'avatar',
        },
      },
      { $unwind: '$avatar' },
      {
        $project: {
          _id: 0,
          avatarId: '$_id',
          purchases: 1,
          name: '$avatar.name',
          slug: '$avatar.slug',
          category: '$avatar.category',
          price: '$avatar.price',
        },
      },
    ]);
  }
}
