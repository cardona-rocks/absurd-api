import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Match, MatchDocument } from './schemas/match.schema';
import { RoundSchema } from './schemas/round.schema';
import { UsersService } from '../users/users.service';
import { AvatarsService } from '../avatars/avatars.service';
import { Choice } from './schemas/round.schema';

const WINS_NEEDED = 3;

@Injectable()
export class MatchesService {
  private pendingChoices = new Map<string, { player1?: Choice; player2?: Choice }>();

  constructor(
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    private usersService: UsersService,
    private avatarsService: AvatarsService,
  ) {}

  private addLog(match: MatchDocument, message: string): void {
    match.log.push({ timestamp: new Date(), message });
  }

  async createOrJoin(userId: string): Promise<MatchDocument> {
    const user = await this.usersService.getOrThrow(userId);
    if (!user.avatar) {
      throw new BadRequestException('You must select an avatar before joining a match');
    }

    let match = await this.matchModel
      .findOne({ status: 'Searching' })
      .sort({ createdAt: 1 })
      .exec();

    if (match) {
      if (match.player1.userId.toString() === userId) {
        throw new BadRequestException('You are already in this match');
      }
      match.player2 = {
        userId: new Types.ObjectId(userId),
        avatarId: user.avatar as Types.ObjectId,
      };
      match.status = 'In progress';
      this.addLog(match, `${user.name} joined the match.`);
      await match.save();
      await match.populate(['player1.userId', 'player1.avatarId', 'player2.userId', 'player2.avatarId']);
      return match;
    }

    match = await this.matchModel.create({
      player1: {
        userId: new Types.ObjectId(userId),
        avatarId: user.avatar,
      },
      player2: null,
      rounds: [],
      matchWinner: null,
      status: 'Searching',
      log: [{ timestamp: new Date(), message: `${user.name} created the match. Waiting for opponent.` }],
      timestamp: new Date(),
    });
    await match.populate(['player1.userId', 'player1.avatarId']);
    return match;
  }

  async getMatch(matchId: string): Promise<MatchDocument> {
    const match = await this.matchModel
      .findById(matchId)
      .populate('player1.userId', 'name email')
      .populate('player1.avatarId', 'name')
      .populate('player2.userId', 'name email')
      .populate('player2.avatarId', 'name')
      .populate('matchWinner', 'name')
      .exec();
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  private roundWinner(p1: Choice, p2: Choice): 'player1' | 'player2' | 'draw' {
    if (p1 === p2) return 'draw';
    if (
      (p1 === 'rock' && p2 === 'scissors') ||
      (p1 === 'paper' && p2 === 'rock') ||
      (p1 === 'scissors' && p2 === 'paper')
    ) {
      return 'player1';
    }
    return 'player2';
  }

  private countWins(rounds: RoundSchema[], player: 'player1' | 'player2'): number {
    return rounds.filter((r) => r.winner === player).length;
  }

  async playRound(
    matchId: string,
    userId: string,
    choice: Choice,
  ): Promise<{ match: MatchDocument; roundResult: RoundSchema | null; gameOver: boolean; winnerId?: string }> {
    const match = await this.matchModel.findById(matchId).exec();
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== 'In progress') {
      throw new BadRequestException('Match is not in progress');
    }

    const isPlayer1 = match.player1.userId.toString() === userId;
    const isPlayer2 = match.player2 && match.player2.userId.toString() === userId;
    if (!isPlayer1 && !isPlayer2) {
      throw new ForbiddenException('You are not in this match');
    }

    let pending = this.pendingChoices.get(matchId);
    if (!pending) {
      pending = {};
      this.pendingChoices.set(matchId, pending);
    }
    if (isPlayer1) pending.player1 = choice;
    else pending.player2 = choice;

    const [p1User, p2User] = await Promise.all([
      this.usersService.findById(match.player1.userId.toString()),
      match.player2 ? this.usersService.findById(match.player2.userId.toString()) : Promise.resolve(null),
    ]);
    const p1Name = p1User?.name ?? 'Player 1';
    const p2Name = p2User?.name ?? 'Player 2';
    this.addLog(match, `${isPlayer1 ? p1Name : p2Name} chose ${choice}.`);
    await match.save();

    const p1Choice = pending.player1;
    const p2Choice = pending.player2;

    if (p1Choice === undefined || p2Choice === undefined) {
      return {
        match: await this.getMatch(matchId),
        roundResult: null,
        gameOver: false,
      };
    }

    const roundIndex = match.rounds.length;
    const winner = this.roundWinner(p1Choice, p2Choice);
    const round: RoundSchema = {
      player1Choice: p1Choice,
      player2Choice: p2Choice,
      winner,
    };
    match.rounds.push(round);
    const roundWinnerName = winner === 'draw' ? 'Draw' : winner === 'player1' ? p1Name : p2Name;
    this.addLog(
      match,
      `Round ${roundIndex + 1}: ${p1Name} ${p1Choice} vs ${p2Name} ${p2Choice} → ${roundWinnerName}`,
    );

    this.pendingChoices.delete(matchId);

    const p1Wins = this.countWins(match.rounds, 'player1');
    const p2Wins = this.countWins(match.rounds, 'player2');
    let gameOver = false;
    let winnerId: string | undefined;

    if (p1Wins >= WINS_NEEDED || p2Wins >= WINS_NEEDED) {
      match.status = 'Complete';
      match.matchWinner = p1Wins >= WINS_NEEDED ? match.player1.userId : match.player2!.userId;
      winnerId = match.matchWinner.toString();
      gameOver = true;
      const winnerName = (p1Wins >= WINS_NEEDED ? p1Name : p2Name);
      this.addLog(match, `Match over. Winner: ${winnerName}`);
      await this.usersService.updateStats(match.player1.userId.toString(), p1Wins > p2Wins ? 'win' : p2Wins > p1Wins ? 'lose' : 'draw');
      if (match.player2) {
        await this.usersService.updateStats(match.player2.userId.toString(), p2Wins > p1Wins ? 'win' : p1Wins > p2Wins ? 'lose' : 'draw');
      }
    }

    await match.save();

    const updated = await this.getMatch(matchId);
    return { match: updated, roundResult: round, gameOver, winnerId };
  }

  async forfeitByInactivity(matchId: string, inactiveUserId: string): Promise<MatchDocument | null> {
    const match = await this.matchModel.findById(matchId).exec();
    if (!match || match.status !== 'In progress') return match;

    const winnerId = match.player1.userId.toString() === inactiveUserId
      ? match.player2!.userId.toString()
      : match.player1.userId.toString();

    const [inactiveUser, winnerUser] = await Promise.all([
      this.usersService.findById(inactiveUserId),
      this.usersService.findById(winnerId),
    ]);
    const inactiveName = inactiveUser?.name ?? 'Player';
    const winnerName = winnerUser?.name ?? 'Winner';

    match.status = 'Complete';
    match.matchWinner = new Types.ObjectId(winnerId);
    this.addLog(match, `${inactiveName} forfeited by inactivity. Winner: ${winnerName}`);
    await match.save();

    await this.usersService.updateStats(inactiveUserId, 'lose');
    await this.usersService.updateStats(winnerId, 'win');

    return this.getMatch(matchId);
  }

  getPendingChoices(matchId: string): { player1?: Choice; player2?: Choice } {
    return this.pendingChoices.get(matchId) ?? {};
  }
}
