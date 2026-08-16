import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  AchievementDefinition,
  AchievementMetric,
  SERIES_TIERS,
} from './achievements.catalog';
import { POWERUP_IDS } from '../common/constants/game';
import { applyCredits } from '../common/credits';

export interface AchievementView extends AchievementDefinition {
  progress: number;
  unlocked: boolean;
  claimed: boolean;
  unlockedAt: Date | null;
  /**
   * Se le enseña al jugador.
   *
   * De una serie sólo se ven los escalones ya conseguidos y el que toca ahora:
   * enseñar de golpe "gana 1000 rondas" cuando llevas 3 no motiva a nadie.
   */
  visible: boolean;
  /** Escalones de la serie ya conseguidos. */
  seriesCleared: number;
}

@Injectable()
export class AchievementsService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  /** Valor actual de cada métrica para un usuario. */
  private metrics(user: UserDocument): Record<AchievementMetric, number> {
    const stats = user.stats ?? ({} as UserDocument['stats']);
    const streak = user.streak ?? ({} as UserDocument['streak']);
    const byChoice = stats.roundsWonByChoice ?? ({} as never);
    const used = stats.powerUpsUsed ?? ({} as never);

    const powerUpMetrics = Object.fromEntries(
      POWERUP_IDS.map((id) => [`powerUpUsed:${id}`, used[id] ?? 0]),
    ) as Record<AchievementMetric, number>;

    return {
      ...powerUpMetrics,
      wins: stats.wins ?? 0,
      winStreak: streak.bestWins ?? 0,
      loginStreak: streak.bestLoginDays ?? 0,
      avatarsOwned: new Set(
        (user.collection ?? [])
          .map((c) => c.avatar?.toString())
          .filter(Boolean),
      ).size,
      matchesPlayed: stats.matchesPlayed ?? 0,
      powerUpsBought: stats.powerUpsBought ?? 0,
      perfectWins: stats.perfectWins ?? 0,
      draws: stats.roundDraws ?? 0,
      roundsWonRock: byChoice.rock ?? 0,
      roundsWonPaper: byChoice.paper ?? 0,
      roundsWonScissors: byChoice.scissors ?? 0,
      // El nivel más alto alcanzado, no el actual: bajar a repetir un nivel
      // viejo no debería quitarle a nadie un logro ya ganado.
      campaignLevel: user.campaign?.bestLevel ?? 1,
      creditsHoarded: stats.creditsHoarded ?? 0,
    };
  }

  /**
   * Recalcula el progreso de todos los logros y persiste los que cambiaron.
   * Devuelve los logros recién desbloqueados para que el cliente los celebre.
   */
  async sync(userId: string): Promise<AchievementDefinition[]> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const values = this.metrics(user);
    const existing = new Map(
      (user.achievements ?? []).map((a) => [a.achievementId, a]),
    );
    const newlyUnlocked: AchievementDefinition[] = [];

    for (const def of ACHIEVEMENTS) {
      const value = Math.min(values[def.metric], def.target);
      let entry = existing.get(def.id);
      if (!entry) {
        entry = {
          achievementId: def.id,
          progress: 0,
          unlocked: false,
          claimed: false,
          unlockedAt: null,
        };
        user.achievements.push(entry);
        existing.set(def.id, entry);
      }
      entry.progress = value;
      if (!entry.unlocked && value >= def.target) {
        entry.unlocked = true;
        entry.unlockedAt = new Date();
        newlyUnlocked.push(def);
      }
    }

    await user.save();
    return newlyUnlocked;
  }

  /**
   * Catálogo con el progreso del jugador.
   *
   * Devuelve sólo lo que tiene sentido enseñar: los logros sueltos, los
   * escalones de serie ya conseguidos —que pueden estar pendientes de cobrar— y
   * el siguiente de cada serie. Así una serie de cinco ocupa una línea, no
   * cinco, y el jugador siempre ve una meta a mano.
   */
  async listForUser(userId: string): Promise<AchievementView[]> {
    await this.sync(userId);
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const byId = new Map(
      (user.achievements ?? []).map((a) => [a.achievementId, a]),
    );
    const isUnlocked = (id: string) => byId.get(id)?.unlocked ?? false;

    /** Escalones conseguidos de cada serie. */
    const cleared: Record<string, number> = {};
    for (const [seriesId, tiers] of Object.entries(SERIES_TIERS)) {
      cleared[seriesId] = tiers.filter((t) => isUnlocked(t.id)).length;
    }

    return ACHIEVEMENTS.map((def) => {
      const p = byId.get(def.id);
      const done = cleared[def.seriesId ?? ''] ?? 0;
      return {
        ...def,
        progress: p?.progress ?? 0,
        unlocked: p?.unlocked ?? false,
        claimed: p?.claimed ?? false,
        unlockedAt: p?.unlockedAt ?? null,
        // Suelto: siempre. De serie: el conseguido o el primero pendiente.
        visible: !def.seriesId || def.tierIndex <= done,
        seriesCleared: done,
      };
    }).filter((a) => a.visible);
  }

  /** Reclama los créditos de un logro desbloqueado. */
  async claim(
    userId: string,
    achievementId: string,
  ): Promise<{ credits: number; reward: number }> {
    const def = ACHIEVEMENT_MAP[achievementId];
    if (!def) throw new NotFoundException('Achievement not found');

    await this.sync(userId);
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const entry = (user.achievements ?? []).find(
      (a) => a.achievementId === achievementId,
    );
    if (!entry?.unlocked) {
      throw new BadRequestException('Achievement not unlocked yet');
    }
    if (entry.claimed) {
      throw new BadRequestException('Reward already claimed');
    }

    entry.claimed = true;
    applyCredits(user, def.reward);
    user.stats.creditsEarned = (user.stats.creditsEarned ?? 0) + def.reward;
    await user.save();

    return { credits: user.credits, reward: def.reward };
  }
}
