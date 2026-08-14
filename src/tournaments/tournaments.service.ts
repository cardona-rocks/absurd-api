import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Tournament,
  TournamentDocument,
  TournamentMatchup,
} from './schemas/tournament.schema';
import { Match, MatchDocument } from '../matches/schemas/match.schema';
import { UsersService } from '../users/users.service';
import { BASE_HEARTS } from '../common/constants/game';

const POPULATE = [
  { path: 'createdBy', select: 'name' },
  { path: 'entrants.userId', select: 'name stats' },
  { path: 'entrants.avatarId', select: 'name slug category sprites' },
  { path: 'bracket.player1', select: 'name' },
  { path: 'bracket.player2', select: 'name' },
  { path: 'bracket.winner', select: 'name' },
  { path: 'champion', select: 'name' },
];

@Injectable()
export class TournamentsService {
  constructor(
    @InjectModel(Tournament.name)
    private tournamentModel: Model<TournamentDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    private usersService: UsersService,
  ) {}

  private code(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join('');
  }

  private async get(id: string): Promise<TournamentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Tournament not found');
    }
    const t = await this.tournamentModel.findById(id).populate(POPULATE).exec();
    if (!t) throw new NotFoundException('Tournament not found');
    return t;
  }

  /** Torneos públicos abiertos o en curso. */
  async listOpen(): Promise<TournamentDocument[]> {
    return this.tournamentModel
      .find({ isPrivate: false, status: { $in: ['Open', 'In progress'] } })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate(POPULATE)
      .exec();
  }

  async findOne(id: string): Promise<TournamentDocument> {
    return this.get(id);
  }

  /** Torneos en los que participa el usuario. */
  async mine(userId: string): Promise<TournamentDocument[]> {
    return this.tournamentModel
      .find({ 'entrants.userId': new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate(POPULATE)
      .exec();
  }

  async create(
    userId: string,
    dto: {
      name: string;
      size: number;
      isPrivate: boolean;
      entryFee: number;
    },
  ): Promise<TournamentDocument> {
    const user = await this.usersService.getOrThrow(userId);
    if (!user.avatar) {
      throw new BadRequestException('Necesitas un avatar para crear un torneo');
    }
    if (dto.entryFee > 0 && user.credits < dto.entryFee) {
      throw new BadRequestException('No tienes créditos para tu propia entrada');
    }

    const created = await this.tournamentModel.create({
      name: dto.name,
      createdBy: new Types.ObjectId(userId),
      isPrivate: dto.isPrivate,
      joinCode: dto.isPrivate ? this.code() : null,
      size: dto.size,
      entryFee: dto.entryFee,
      prizePool: 0,
      status: 'Open',
      entrants: [],
      bracket: [],
    });

    // El creador queda inscrito automáticamente.
    return this.join(userId, created._id.toString());
  }

  async join(
    userId: string,
    tournamentId: string,
    joinCode?: string,
  ): Promise<TournamentDocument> {
    const t = await this.tournamentModel.findById(tournamentId).exec();
    if (!t) throw new NotFoundException('Tournament not found');
    if (t.status !== 'Open') {
      throw new BadRequestException('El torneo ya no admite inscripciones');
    }
    if (t.isPrivate && t.joinCode !== (joinCode ?? '').trim().toUpperCase()) {
      throw new ForbiddenException('Código de torneo incorrecto');
    }
    if (t.entrants.some((e) => e.userId.toString() === userId)) {
      throw new BadRequestException('Ya estás inscrito');
    }
    if (t.entrants.length >= t.size) {
      throw new BadRequestException('El torneo está lleno');
    }

    const user = await this.usersService.getOrThrow(userId);
    if (!user.avatar) {
      throw new BadRequestException('Necesitas un avatar para entrar');
    }
    if (t.entryFee > 0) {
      if (user.credits < t.entryFee) {
        throw new BadRequestException('No tienes créditos suficientes');
      }
      await this.usersService.updateCredits(userId, -t.entryFee);
      t.prizePool += t.entryFee;
    }

    t.entrants.push({
      userId: new Types.ObjectId(userId),
      avatarId: user.avatar as Types.ObjectId,
      seed: t.entrants.length,
      eliminated: false,
      joinedAt: new Date(),
    });

    if (t.entrants.length === t.size) this.seedBracket(t);
    await t.save();
    return this.get(tournamentId);
  }

  /** Sale del torneo antes de que empiece y recupera la entrada. */
  async leave(userId: string, tournamentId: string): Promise<TournamentDocument> {
    const t = await this.tournamentModel.findById(tournamentId).exec();
    if (!t) throw new NotFoundException('Tournament not found');
    if (t.status !== 'Open') {
      throw new BadRequestException('El torneo ya empezó');
    }
    const index = t.entrants.findIndex((e) => e.userId.toString() === userId);
    if (index < 0) throw new BadRequestException('No estás inscrito');

    t.entrants.splice(index, 1);
    t.entrants.forEach((e, i) => (e.seed = i));
    if (t.entryFee > 0) {
      await this.usersService.updateCredits(userId, t.entryFee);
      t.prizePool = Math.max(0, t.prizePool - t.entryFee);
    }
    if (t.entrants.length === 0) t.status = 'Cancelled';
    await t.save();
    return this.get(tournamentId);
  }

  /** Construye el bracket completo con los cruces de la primera ronda. */
  private seedBracket(t: TournamentDocument): void {
    const shuffled = [...t.entrants].sort(() => Math.random() - 0.5);
    shuffled.forEach((e, i) => (e.seed = i));

    const bracket: TournamentMatchup[] = [];
    const rounds = Math.log2(t.size);

    for (let round = 0; round < rounds; round++) {
      const slots = t.size / Math.pow(2, round + 1);
      for (let slot = 0; slot < slots; slot++) {
        bracket.push({
          round,
          slot,
          player1: round === 0 ? shuffled[slot * 2].userId : null,
          player2: round === 0 ? shuffled[slot * 2 + 1].userId : null,
          matchId: null,
          winner: null,
          status: round === 0 ? 'ready' : 'pending',
        });
      }
    }

    t.bracket = bracket;
    t.status = 'In progress';
    t.startedAt = new Date();
  }

  /**
   * Crea (o devuelve) el combate del cruce que le toca al usuario.
   * Ambos jugadores llaman a esto; el primero lo crea y el segundo se une.
   */
  async playNext(
    userId: string,
    tournamentId: string,
  ): Promise<{ tournament: TournamentDocument; matchId: string }> {
    const t = await this.tournamentModel.findById(tournamentId).exec();
    if (!t) throw new NotFoundException('Tournament not found');
    if (t.status !== 'In progress') {
      throw new BadRequestException('El torneo no está en curso');
    }

    const uid = new Types.ObjectId(userId);
    const matchup = t.bracket.find(
      (m) =>
        m.status !== 'complete' &&
        (m.player1?.equals(uid) || m.player2?.equals(uid)),
    );
    if (!matchup) {
      throw new BadRequestException('No tienes ningún cruce pendiente');
    }
    if (!matchup.player1 || !matchup.player2) {
      throw new BadRequestException('Tu rival todavía no está definido');
    }

    if (matchup.matchId) {
      await t.save();
      return { tournament: await this.get(tournamentId), matchId: matchup.matchId.toString() };
    }

    const entrantOf = (id: Types.ObjectId) =>
      t.entrants.find((e) => e.userId.equals(id))!;
    const e1 = entrantOf(matchup.player1);
    const e2 = entrantOf(matchup.player2);

    const created = await this.matchModel.create({
      player1: {
        userId: e1.userId,
        avatarId: e1.avatarId,
        hearts: BASE_HEARTS,
        maxHearts: BASE_HEARTS,
        equippedPowerUps: [],
        usedPowerUps: [],
      },
      player2: {
        userId: e2.userId,
        avatarId: e2.avatarId,
        hearts: BASE_HEARTS,
        maxHearts: BASE_HEARTS,
        equippedPowerUps: [],
        usedPowerUps: [],
      },
      mode: 'tournament',
      tournamentId: t._id,
      status: 'In progress',
      startedAt: new Date(),
      log: [
        {
          timestamp: new Date(),
          message: `Cruce de torneo: ronda ${matchup.round + 1}.`,
        },
      ],
    });

    matchup.matchId = created._id as Types.ObjectId;
    matchup.status = 'in-progress';
    await t.save();

    return { tournament: await this.get(tournamentId), matchId: created._id.toString() };
  }

  /**
   * Registra el ganador de un cruce y avanza el bracket. Lo llama el servicio
   * de combates cuando termina un combate de torneo.
   */
  async reportResult(matchId: string, winnerId: string): Promise<void> {
    const t = await this.tournamentModel
      .findOne({ 'bracket.matchId': new Types.ObjectId(matchId) })
      .exec();
    if (!t) return;

    const matchup = t.bracket.find((m) => m.matchId?.toString() === matchId);
    if (!matchup || matchup.status === 'complete') return;

    const winner = new Types.ObjectId(winnerId);
    matchup.winner = winner;
    matchup.status = 'complete';

    const loserId = matchup.player1?.equals(winner)
      ? matchup.player2
      : matchup.player1;
    const loser = t.entrants.find((e) => loserId && e.userId.equals(loserId));
    if (loser) loser.eliminated = true;

    const rounds = Math.log2(t.size);
    if (matchup.round === rounds - 1) {
      t.champion = winner;
      t.status = 'Complete';
      t.finishedAt = new Date();
      if (t.prizePool > 0) {
        await this.usersService.updateCredits(winnerId, t.prizePool);
      }
    } else {
      // Colocamos al ganador en el cruce de la ronda siguiente.
      const nextSlot = Math.floor(matchup.slot / 2);
      const next = t.bracket.find(
        (m) => m.round === matchup.round + 1 && m.slot === nextSlot,
      );
      if (next) {
        if (matchup.slot % 2 === 0) next.player1 = winner;
        else next.player2 = winner;
        if (next.player1 && next.player2) next.status = 'ready';
      }
    }

    await t.save();
  }
}
