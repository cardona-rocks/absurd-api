import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MatchesService, RoundResolution } from './matches.service';
import {
  Choice,
  CHOICES,
  PowerUpId,
  INACTIVITY_MS,
  RECONNECT_GRACE_MS,
  ROUND_TIMEOUT_SECONDS,
} from '../common/constants/game';

interface SocketMeta {
  userId: string;
  matchId: string;
  lastActivity: number;
}

const room = (matchId: string) => `match:${matchId}`;

@WebSocketGateway({
  namespace: 'match',
  cors: { origin: '*' },
})
export class MatchesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MatchesGateway.name);

  /** socket.id -> metadatos de la conexión. */
  private clients = new Map<string, SocketMeta>();
  /** matchId -> temporizador de inactividad. */
  private inactivityTimers = new Map<string, NodeJS.Timeout>();
  /** userId -> temporizador de gracia por desconexión. */
  private disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private matchesService: MatchesService,
    private jwtService: JwtService,
  ) {}

  // ------------------------------------------------------------ ciclo vida

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake?.auth?.token as string) ??
        (client.handshake?.query?.token as string);
      const matchId = client.handshake?.query?.matchId as string;

      if (!token || !matchId) {
        client.emit('error_message', { message: 'Faltan credenciales' });
        return client.disconnect();
      }

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET || 'secret',
      });
      const userId = payload.sub;

      const match = await this.matchesService.getMatch(matchId);
      const inMatch =
        match.player1?.userId?._id?.toString() === userId ||
        match.player1?.userId?.toString() === userId ||
        match.player2?.userId?._id?.toString() === userId ||
        match.player2?.userId?.toString() === userId;
      if (!inMatch) {
        client.emit('error_message', { message: 'No estás en este combate' });
        return client.disconnect();
      }

      const meta: SocketMeta = { userId, matchId, lastActivity: Date.now() };
      this.clients.set(client.id, meta);
      client.data = meta;
      await client.join(room(matchId));

      // Volvió antes de que se agotara la gracia: cancelamos la derrota.
      const pendingDisconnect = this.disconnectTimers.get(userId);
      if (pendingDisconnect) {
        clearTimeout(pendingDisconnect);
        this.disconnectTimers.delete(userId);
        this.server.to(room(matchId)).emit('opponent_reconnected', { userId });
      }

      client.emit('match_state', {
        match,
        roundTimeout: ROUND_TIMEOUT_SECONDS,
      });
      this.server.to(room(matchId)).emit('player_joined', { userId });

      if (match.status === 'In progress') this.watchInactivity(matchId);
    } catch (e) {
      this.logger.warn(`Conexión rechazada: ${(e as Error).message}`);
      client.emit('error_message', { message: 'Sesión inválida' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const meta = this.clients.get(client.id);
    this.clients.delete(client.id);
    if (!meta) return;

    const { userId, matchId } = meta;

    // ¿Le queda alguna otra pestaña abierta?
    const stillConnected = [...this.clients.values()].some(
      (m) => m.userId === userId && m.matchId === matchId,
    );
    if (stillConnected) return;

    this.server.to(room(matchId)).emit('opponent_disconnected', {
      userId,
      graceMs: RECONNECT_GRACE_MS,
    });

    const timer = setTimeout(async () => {
      this.disconnectTimers.delete(userId);
      const result = await this.matchesService.forfeit(
        matchId,
        userId,
        'disconnect',
      );
      if (result) this.emitComplete(matchId, result);
    }, RECONNECT_GRACE_MS);

    this.disconnectTimers.set(userId, timer);
  }

  // -------------------------------------------------------------- eventos

  @SubscribeMessage('choice')
  async handleChoice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { choice: Choice },
  ) {
    const meta = this.clients.get(client.id);
    if (!meta) return;
    if (!data?.choice || !CHOICES.includes(data.choice)) {
      return client.emit('error_message', { message: 'Jugada inválida' });
    }

    meta.lastActivity = Date.now();
    const { matchId, userId } = meta;

    try {
      const result = await this.matchesService.playRound(
        matchId,
        userId,
        data.choice,
      );

      // Confirmamos al que eligió sin revelar la jugada al rival.
      client.emit('choice_locked', { choice: data.choice });
      client.broadcast.to(room(matchId)).emit('opponent_locked', { userId });

      if (!result.round) return;

      this.server.to(room(matchId)).emit('round_result', {
        round: result.round,
        match: result.match,
        gameOver: result.gameOver,
        winnerId: result.winnerId,
      });

      if (result.gameOver) this.emitComplete(matchId, result);
    } catch (e) {
      client.emit('error_message', { message: (e as Error).message });
    }
  }

  @SubscribeMessage('use_powerup')
  async handlePowerUp(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { powerUpId: PowerUpId },
  ) {
    const meta = this.clients.get(client.id);
    if (!meta || !data?.powerUpId) return;
    meta.lastActivity = Date.now();

    try {
      const { match, revealed } = await this.matchesService.usePowerUp(
        meta.matchId,
        meta.userId,
        data.powerUpId,
      );

      // "Ojo Chismoso" solo lo ve quien lo usó.
      if (data.powerUpId === 'revelar') {
        client.emit('powerup_reveal', { choice: revealed ?? null });
      }

      this.server.to(room(meta.matchId)).emit('powerup_used', {
        userId: meta.userId,
        powerUpId: data.powerUpId,
        match,
      });
    } catch (e) {
      client.emit('error_message', { message: (e as Error).message });
    }
  }

  @SubscribeMessage('forfeit')
  async handleForfeit(@ConnectedSocket() client: Socket) {
    const meta = this.clients.get(client.id);
    if (!meta) return;
    const result = await this.matchesService.forfeit(
      meta.matchId,
      meta.userId,
      'forfeit',
    );
    if (result) this.emitComplete(meta.matchId, result);
  }

  /** Latido para no perder por inactividad mientras el jugador mira la pantalla. */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const meta = this.clients.get(client.id);
    if (meta) meta.lastActivity = Date.now();
    client.emit('pong', { at: Date.now() });
  }

  // -------------------------------------------------------------- internos

  private emitComplete(matchId: string, result: RoundResolution) {
    this.server.to(room(matchId)).emit('match_complete', {
      match: result.match,
      winnerId: result.winnerId,
      reason: result.match.endReason,
      unlocked: result.unlocked ?? {},
    });
    this.clearInactivity(matchId);
  }

  /**
   * Un solo temporizador por combate: si alguien pasa más de INACTIVITY_MS sin
   * actuar, pierde y el rival gana.
   */
  private watchInactivity(matchId: string) {
    if (this.inactivityTimers.has(matchId)) return;

    const interval = setInterval(async () => {
      const metas = [...this.clients.values()].filter(
        (m) => m.matchId === matchId,
      );
      if (metas.length === 0) {
        this.clearInactivity(matchId);
        return;
      }

      const now = Date.now();
      const idle = metas.find((m) => now - m.lastActivity > INACTIVITY_MS);
      if (!idle) return;

      this.clearInactivity(matchId);
      const result = await this.matchesService.forfeit(
        matchId,
        idle.userId,
        'inactivity',
      );
      if (result) this.emitComplete(matchId, result);
    }, 10_000);

    this.inactivityTimers.set(matchId, interval);
  }

  private clearInactivity(matchId: string) {
    const timer = this.inactivityTimers.get(matchId);
    if (timer) {
      clearInterval(timer);
      this.inactivityTimers.delete(matchId);
    }
  }
}
