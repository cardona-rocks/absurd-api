import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Match, MatchDocument, MatchMode } from './schemas/match.schema';
import { RoundSchema } from './schemas/round.schema';
import { PlayerSchema } from './schemas/player.schema';
import { UsersService } from '../users/users.service';
import { AvatarsService } from '../avatars/avatars.service';
import { PowerUpsService } from '../powerups/powerups.service';
import { AchievementsService } from '../achievements/achievements.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import {
  BASE_HEARTS,
  MAX_ROUNDS,
  WIN_REWARD,
  LOSS_REWARD,
  ROUND_REWARD,
  DOUBLE_OR_NOTHING_MULTIPLIER,
  Choice,
  CHOICES,
  PowerUpId,
  resolveRound,
} from '../common/constants/game';

type Side = 'player1' | 'player2';

export interface RoundResolution {
  match: MatchDocument;
  round: RoundSchema | null;
  gameOver: boolean;
  winnerId?: string;
  /** Logros desbloqueados por cada jugador al terminar. */
  unlocked?: Record<string, { id: string; name: string; reward: number }[]>;
}

const POPULATE = [
  { path: 'player1.userId', select: 'name email stats' },
  { path: 'player1.avatarId', select: 'name slug category sprites weapons' },
  { path: 'player2.userId', select: 'name email stats' },
  { path: 'player2.avatarId', select: 'name slug category sprites weapons' },
  { path: 'matchWinner', select: 'name' },
];

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  /**
   * Elecciones de la ronda en curso, en memoria. Se limpian al resolver la
   * ronda. Asume una sola instancia del proceso; con varias habría que
   * moverlo a Redis o a un campo del documento.
   */
  private pendingChoices = new Map<string, Partial<Record<Side, Choice>>>();

  constructor(
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    private usersService: UsersService,
    private avatarsService: AvatarsService,
    private powerUpsService: PowerUpsService,
    private achievementsService: AchievementsService,
    private tournamentsService: TournamentsService,
  ) {}

  // ---------------------------------------------------------------- helpers

  private addLog(match: MatchDocument, message: string): void {
    match.log.push({ timestamp: new Date(), message });
  }

  private sideOf(match: MatchDocument, userId: string): Side | null {
    if (match.player1?.userId?.toString() === userId) return 'player1';
    if (match.player2?.userId?.toString() === userId) return 'player2';
    return null;
  }

  private other(side: Side): Side {
    return side === 'player1' ? 'player2' : 'player1';
  }

  private generateRoomCode(): string {
    // Sin caracteres ambiguos (0/O, 1/I) para que se pueda dictar en voz alta.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join('');
  }

  /**
   * Monta un jugador del combate.
   *
   * En el PvP no entran power ups: son cosa de la campaña. Contra otra persona
   * darían ventaja a quien más compre, así que el enfrentamiento entre jugadores
   * se juega a manos limpias. Se ignora lo que pida el cliente en vez de
   * devolver error, para que una app antigua que aún los mande siga funcionando;
   * lo que no puede pasar es que se equipen o se gasten.
   */
  private buildPlayer(userId: string, avatarId: Types.ObjectId): PlayerSchema {
    const equipped: PowerUpId[] = [];
    const maxHearts = BASE_HEARTS;

    return {
      userId: new Types.ObjectId(userId),
      avatarId,
      hearts: maxHearts,
      maxHearts,
      equippedPowerUps: equipped,
      usedPowerUps: [],
      shieldActive: false,
      criticalArmed: false,
      creditsEarned: 0,
      ready: false,
      disconnectedAt: null,
    };
  }

  private async assertPlayable(userId: string) {
    const user = await this.usersService.getOrThrow(userId);
    if (!user.avatar) {
      throw new BadRequestException(
        'Necesitas un avatar antes de entrar a un combate',
      );
    }
    return user;
  }

  async getMatch(matchId: string): Promise<MatchDocument> {
    if (!Types.ObjectId.isValid(matchId)) {
      throw new NotFoundException('Match not found');
    }
    const match = await this.matchModel
      .findById(matchId)
      .populate(POPULATE)
      .exec();
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  // ------------------------------------------------------------ matchmaking

  /** Busca un combate rápido abierto o crea uno nuevo. */
  async createOrJoin(userId: string): Promise<MatchDocument> {
    const user = await this.assertPlayable(userId);
    const avatarId = user.avatar as Types.ObjectId;

    const open = await this.matchModel
      .findOne({
        status: 'Searching',
        mode: 'quick',
        'player1.userId': { $ne: new Types.ObjectId(userId) },
      })
      .sort({ createdAt: 1 })
      .exec();

    if (open) {
      open.player2 = this.buildPlayer(userId, avatarId);
      open.status = 'In progress';
      open.startedAt = new Date();
      open.lastActivityAt = new Date();
      this.addLog(open, `${user.name} se unió. ¡Que empiece lo absurdo!`);
      await open.save();
      return this.getMatch(open._id.toString());
    }

    const created = await this.matchModel.create({
      player1: this.buildPlayer(userId, avatarId),
      player2: null,
      mode: 'quick',
      status: 'Searching',
      log: [
        {
          timestamp: new Date(),
          message: `${user.name} busca rival...`,
        },
      ],
      lastActivityAt: new Date(),
    });
    return this.getMatch(created._id.toString());
  }

  /** Crea una sala privada con código para invitar a un amigo. */
  async createPrivate(userId: string): Promise<MatchDocument> {
    const user = await this.assertPlayable(userId);
    const avatarId = user.avatar as Types.ObjectId;

    let roomCode = this.generateRoomCode();
    // Colisión improbable pero barata de comprobar.
    while (
      await this.matchModel.exists({
        roomCode,
        status: { $in: ['Searching', 'In progress'] },
      })
    ) {
      roomCode = this.generateRoomCode();
    }

    const created = await this.matchModel.create({
      player1: this.buildPlayer(userId, avatarId),
      player2: null,
      mode: 'private' as MatchMode,
      roomCode,
      status: 'Searching',
      log: [
        {
          timestamp: new Date(),
          message: `${user.name} creó la sala ${roomCode}.`,
        },
      ],
      lastActivityAt: new Date(),
    });
    return this.getMatch(created._id.toString());
  }

  /** Entra a una sala privada usando su código. */
  async joinPrivate(userId: string, code: string): Promise<MatchDocument> {
    const user = await this.assertPlayable(userId);
    const roomCode = code.trim().toUpperCase();

    const match = await this.matchModel
      .findOne({ roomCode, status: 'Searching' })
      .exec();
    if (!match) {
      throw new NotFoundException(
        'No encontramos esa sala. ¿El código está bien?',
      );
    }
    if (match.player1.userId.toString() === userId) {
      throw new BadRequestException('Ya estás en esta sala, esperando rival');
    }

    match.player2 = this.buildPlayer(userId, user.avatar as Types.ObjectId);
    match.status = 'In progress';
    match.startedAt = new Date();
    match.lastActivityAt = new Date();
    this.addLog(match, `${user.name} entró a la sala ${roomCode}.`);
    await match.save();
    return this.getMatch(match._id.toString());
  }

  /** Cancela un combate que sigue buscando rival. */
  async cancelSearch(userId: string, matchId: string): Promise<MatchDocument> {
    const match = await this.matchModel.findById(matchId).exec();
    if (!match) throw new NotFoundException('Match not found');
    if (match.player1.userId.toString() !== userId) {
      throw new ForbiddenException('No es tu sala');
    }
    if (match.status !== 'Searching') {
      throw new BadRequestException('El combate ya empezó');
    }
    match.status = 'Cancelled';
    this.addLog(match, 'Búsqueda cancelada.');
    await match.save();
    return this.getMatch(matchId);
  }

  /** Crea una revancha entre los mismos dos jugadores. */
  async rematch(userId: string, matchId: string): Promise<MatchDocument> {
    const previous = await this.matchModel.findById(matchId).exec();
    if (!previous) throw new NotFoundException('Match not found');
    if (previous.status !== 'Complete') {
      throw new BadRequestException('El combate anterior no ha terminado');
    }
    const side = this.sideOf(previous, userId);
    if (!side) throw new ForbiddenException('No jugaste ese combate');

    // Si el rival ya pidió revancha, nos unimos a la suya.
    const pending = await this.matchModel
      .findOne({ rematchOf: previous._id, status: 'Searching' })
      .exec();
    if (pending && pending.player1.userId.toString() !== userId) {
      return this.joinPrivate(userId, pending.roomCode ?? '');
    }
    if (pending) return this.getMatch(pending._id.toString());

    const user = await this.assertPlayable(userId);
    const created = await this.matchModel.create({
      player1: this.buildPlayer(userId, user.avatar as Types.ObjectId),
      player2: null,
      mode: previous.mode,
      roomCode: this.generateRoomCode(),
      rematchOf: previous._id,
      status: 'Searching',
      log: [{ timestamp: new Date(), message: `${user.name} pide revancha.` }],
      lastActivityAt: new Date(),
    });
    return this.getMatch(created._id.toString());
  }

  // ---------------------------------------------------------------- combate

  /** Activa un power up durante el combate. */
  async usePowerUp(
    matchId: string,
    userId: string,
    powerUpId: PowerUpId,
  ): Promise<{ match: MatchDocument; revealed?: Choice | null }> {
    const match = await this.matchModel.findById(matchId).exec();
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== 'In progress') {
      throw new BadRequestException('El combate no está en curso');
    }
    const side = this.sideOf(match, userId);
    if (!side) throw new ForbiddenException('No estás en este combate');

    // Los power ups son exclusivos de la campaña: en el PvP nadie lleva
    // ninguno equipado, así que este camino siempre se corta aquí.
    const me = match[side] as PlayerSchema;
    if (!me.equippedPowerUps.includes(powerUpId)) {
      throw new BadRequestException(
        'Los power ups sólo se pueden usar en la campaña',
      );
    }
    if (me.usedPowerUps.includes(powerUpId)) {
      throw new BadRequestException('Ya usaste ese power up');
    }
    if (!(await this.powerUpsService.consume(userId, powerUpId))) {
      throw new BadRequestException('No te quedan unidades de ese power up');
    }

    me.usedPowerUps.push(powerUpId);
    match.lastActivityAt = new Date();
    let revealed: Choice | null | undefined;

    switch (powerUpId) {
      case 'escudo':
        me.shieldActive = true;
        this.addLog(match, 'Escudo Absurdo levantado.');
        break;
      case 'critico':
        me.criticalArmed = true;
        this.addLog(match, 'Golpe Crítico cargado.');
        break;
      case 'curita':
        me.hearts = Math.min(me.maxHearts, me.hearts + 1);
        this.addLog(match, 'Curita Mágica: +1 corazón.');
        break;
      case 'revelar': {
        const pending = this.pendingChoices.get(matchId) ?? {};
        revealed = pending[this.other(side)] ?? null;
        this.addLog(match, 'Ojo Chismoso: alguien está espiando.');
        break;
      }
      default:
        throw new BadRequestException('Ese power up no se activa en combate');
    }

    await match.save();
    return { match: await this.getMatch(matchId), revealed };
  }

  /**
   * Registra la elección de un jugador. Cuando ambos han elegido resuelve la
   * ronda, aplica corazones y decide si el combate terminó.
   */
  async playRound(
    matchId: string,
    userId: string,
    choice: Choice,
  ): Promise<RoundResolution> {
    if (!CHOICES.includes(choice)) {
      throw new BadRequestException('Jugada inválida');
    }

    const match = await this.matchModel.findById(matchId).exec();
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== 'In progress') {
      throw new BadRequestException('El combate no está en curso');
    }

    const side = this.sideOf(match, userId);
    if (!side) throw new ForbiddenException('No estás en este combate');

    const pending = this.pendingChoices.get(matchId) ?? {};
    if (pending[side]) {
      throw new BadRequestException('Ya elegiste en esta ronda');
    }
    pending[side] = choice;
    this.pendingChoices.set(matchId, pending);

    match.lastActivityAt = new Date();
    await match.save();

    if (!pending.player1 || !pending.player2) {
      return {
        match: await this.getMatch(matchId),
        round: null,
        gameOver: false,
      };
    }

    this.pendingChoices.delete(matchId);
    return this.resolve(match, pending.player1, pending.player2);
  }

  private async resolve(
    match: MatchDocument,
    p1Choice: Choice,
    p2Choice: Choice,
  ): Promise<RoundResolution> {
    const p1 = match.player1;
    const p2 = match.player2!;

    let winner = resolveRound(p1Choice, p2Choice);
    let altered = false;

    // El crítico fuerza la victoria de quien lo armó. Si ambos lo usan, se anulan.
    if (p1.criticalArmed && p2.criticalArmed) {
      winner = 'draw';
      altered = true;
    } else if (p1.criticalArmed) {
      winner = 'player1';
      altered = true;
    } else if (p2.criticalArmed) {
      winner = 'player2';
      altered = true;
    }
    p1.criticalArmed = false;
    p2.criticalArmed = false;

    // El perdedor de la ronda pierde un corazón, salvo que tenga escudo.
    if (winner !== 'draw') {
      const loser = winner === 'player1' ? p2 : p1;
      if (loser.shieldActive) {
        loser.shieldActive = false;
        altered = true;
        this.addLog(match, 'El escudo absorbió el golpe.');
      } else {
        loser.hearts = Math.max(0, loser.hearts - 1);
      }
    }

    const round: RoundSchema = {
      player1Choice: p1Choice,
      player2Choice: p2Choice,
      winner,
      player1PowerUps: [],
      player2PowerUps: [],
      player1Hearts: p1.hearts,
      player2Hearts: p2.hearts,
      altered,
      playedAt: new Date(),
    };
    match.rounds.push(round);

    const [n1, n2] = await Promise.all([
      this.usersService.findById(p1.userId.toString()),
      this.usersService.findById(p2.userId.toString()),
    ]);
    const name1 = n1?.name ?? 'Jugador 1';
    const name2 = n2?.name ?? 'Jugador 2';
    const label =
      winner === 'draw' ? 'Empate' : winner === 'player1' ? name1 : name2;
    this.addLog(
      match,
      `Ronda ${match.rounds.length}: ${name1} ${p1Choice} vs ${name2} ${p2Choice} → ${label}`,
    );

    const outOfHearts = p1.hearts <= 0 || p2.hearts <= 0;
    const roundLimit = match.rounds.length >= MAX_ROUNDS;

    if (!outOfHearts && !roundLimit) {
      match.lastActivityAt = new Date();
      await match.save();
      return {
        match: await this.getMatch(match._id.toString()),
        round,
        gameOver: false,
      };
    }

    const winnerSide: Side | null =
      p1.hearts === p2.hearts
        ? null
        : p1.hearts > p2.hearts
          ? 'player1'
          : 'player2';

    return this.finish(
      match,
      winnerSide,
      outOfHearts ? 'hearts' : 'round-limit',
      round,
    );
  }

  /** Cierra el combate: premios, estadísticas y logros. */
  private async finish(
    match: MatchDocument,
    winnerSide: Side | null,
    reason: 'hearts' | 'round-limit' | 'inactivity' | 'disconnect' | 'forfeit',
    round: RoundSchema | null = null,
  ): Promise<RoundResolution> {
    match.status = 'Complete';
    match.endReason = reason;
    match.finishedAt = new Date();
    match.matchWinner = winnerSide ? match[winnerSide]!.userId : null;

    const roundsWon: Record<Side, number> = {
      player1: match.rounds.filter((r) => r.winner === 'player1').length,
      player2: match.rounds.filter((r) => r.winner === 'player2').length,
    };
    const roundDraws = match.rounds.filter((r) => r.winner === 'draw').length;

    const unlocked: RoundResolution['unlocked'] = {};

    for (const side of ['player1', 'player2'] as Side[]) {
      const player = match[side] as PlayerSchema;
      const uid = player.userId.toString();
      const won = winnerSide === side;
      const drew = winnerSide === null;

      let credits =
        roundsWon[side] * ROUND_REWARD +
        (won ? WIN_REWARD : drew ? 0 : LOSS_REWARD);

      // Doble o Nada: el doble si ganas, nada si no.
      if (player.equippedPowerUps.includes('doble')) {
        credits = won ? credits * DOUBLE_OR_NOTHING_MULTIPLIER : 0;
      }
      player.creditsEarned = credits;

      const perfect = won && player.hearts === player.maxHearts;

      // Con qué jugada ganó cada ronda: alimenta las series de Combate.
      const roundsWonByChoice: Partial<Record<Choice, number>> = {};
      for (const r of match.rounds) {
        if (r.winner !== side) continue;
        const choice = side === 'player1' ? r.player1Choice : r.player2Choice;
        roundsWonByChoice[choice] = (roundsWonByChoice[choice] ?? 0) + 1;
      }

      await this.usersService.applyMatchResult(uid, {
        result: won ? 'win' : drew ? 'draw' : 'lose',
        credits,
        roundsWon: roundsWon[side],
        roundsLost: roundsWon[this.other(side)],
        roundDraws,
        perfect,
        roundsWonByChoice,
      });

      const gained = await this.achievementsService.sync(uid);
      unlocked[uid] = gained.map((a) => ({
        id: a.id,
        name: a.name,
        reward: a.reward,
      }));
    }

    const winnerName = winnerSide
      ? (await this.usersService.findById(match[winnerSide]!.userId.toString()))
          ?.name
      : null;
    this.addLog(
      match,
      winnerName
        ? `Fin del combate. Gana ${winnerName}.`
        : 'Fin del combate. Empate absurdo.',
    );

    await match.save();
    this.pendingChoices.delete(match._id.toString());

    // Si era un cruce de torneo, avanzamos el bracket.
    if (match.tournamentId && match.matchWinner) {
      try {
        await this.tournamentsService.reportResult(
          match._id.toString(),
          match.matchWinner.toString(),
        );
      } catch (e) {
        this.logger.error(
          `No se pudo avanzar el bracket del torneo: ${(e as Error).message}`,
        );
      }
    }

    return {
      match: await this.getMatch(match._id.toString()),
      round,
      gameOver: true,
      winnerId: match.matchWinner?.toString(),
      unlocked,
    };
  }

  /** El jugador abandona: pierde y el rival gana. */
  async forfeit(
    matchId: string,
    userId: string,
    reason: 'inactivity' | 'disconnect' | 'forfeit' = 'forfeit',
  ): Promise<RoundResolution | null> {
    const match = await this.matchModel.findById(matchId).exec();
    if (!match) return null;

    if (match.status === 'Searching') {
      match.status = 'Cancelled';
      this.addLog(match, 'El creador abandonó la sala.');
      await match.save();
      return null;
    }
    if (match.status !== 'In progress') return null;

    const side = this.sideOf(match, userId);
    if (!side) return null;

    const loser = match[side] as PlayerSchema;
    loser.hearts = 0;
    const label =
      reason === 'inactivity'
        ? 'por inactividad'
        : reason === 'disconnect'
          ? 'por desconexión'
          : 'voluntariamente';
    this.addLog(match, `Un jugador abandonó ${label}.`);

    return this.finish(match, this.other(side), reason);
  }

  /** Combates activos del usuario, para reconectar tras cerrar la app. */
  async activeForUser(userId: string): Promise<MatchDocument | null> {
    const id = new Types.ObjectId(userId);
    return this.matchModel
      .findOne({
        status: { $in: ['Searching', 'In progress'] },
        $or: [{ 'player1.userId': id }, { 'player2.userId': id }],
      })
      .sort({ createdAt: -1 })
      .populate(POPULATE)
      .exec();
  }

  /** Historial de combates terminados. */
  async historyForUser(userId: string, limit = 20): Promise<MatchDocument[]> {
    const id = new Types.ObjectId(userId);
    return this.matchModel
      .find({
        status: 'Complete',
        $or: [{ 'player1.userId': id }, { 'player2.userId': id }],
      })
      .sort({ finishedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .populate(POPULATE)
      .exec();
  }

  getPendingChoices(matchId: string): Partial<Record<Side, Choice>> {
    return this.pendingChoices.get(matchId) ?? {};
  }

  /** Quién falta por elegir, para que el gateway avise al cliente. */
  hasChosen(matchId: string, side: Side): boolean {
    return Boolean(this.pendingChoices.get(matchId)?.[side]);
  }
}
