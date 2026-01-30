import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MatchesService } from './matches.service';
import { Choice } from './schemas/round.schema';

const INACTIVITY_MS = 60 * 1000;

interface AuthenticatedSocket {
  id: string;
  userId: string;
  matchId: string;
  lastActivity: number;
}

@WebSocketGateway({
  namespace: 'match',
  cors: { origin: '*' },
})
export class MatchesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientMap = new Map<string, AuthenticatedSocket>();
  private inactivityIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private matchesService: MatchesService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: any) {
    try {
      const token = client.handshake?.auth?.token ?? client.handshake?.query?.token;
      const matchId = client.handshake?.query?.matchId;
      if (!token || !matchId) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'secret',
      });
      const userId = payload.sub;
      const meta: AuthenticatedSocket = {
        id: client.id,
        userId,
        matchId,
        lastActivity: Date.now(),
      };
      this.clientMap.set(client.id, meta);
      client.join(`match:${matchId}`);
      client.data = meta;

      const match = await this.matchesService.getMatch(matchId);
      client.emit('match_state', match);

      this.scheduleInactivityCheck(matchId, client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: any) {
    const meta = this.clientMap.get(client.id);
    if (meta) {
      this.clientMap.delete(client.id);
      this.clearInactivityCheck(client.id);
    }
  }

  private scheduleInactivityCheck(matchId: string, clientId: string) {
    this.clearInactivityCheck(clientId);
    const interval = setInterval(async () => {
      const meta = this.clientMap.get(clientId);
      if (!meta) {
        clearInterval(interval);
        this.inactivityIntervals.delete(clientId);
        return;
      }
      if (Date.now() - meta.lastActivity > INACTIVITY_MS) {
        const match = await this.matchesService.forfeitByInactivity(matchId, meta.userId);
        if (match) {
          this.server.to(`match:${matchId}`).emit('match_complete', { match, reason: 'inactivity', forfeitUserId: meta.userId });
        }
        this.clientMap.delete(clientId);
        this.inactivityIntervals.delete(clientId);
        clearInterval(interval);
      }
    }, 15000);
    this.inactivityIntervals.set(clientId, interval);
  }

  private clearInactivityCheck(clientId: string) {
    const interval = this.inactivityIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.inactivityIntervals.delete(clientId);
    }
  }

  @SubscribeMessage('choice')
  async handleChoice(
    @ConnectedSocket() client: any,
    @MessageBody() data: { choice: Choice },
  ) {
    const meta = this.clientMap.get(client.id) ?? client.data;
    if (!meta || !data?.choice) return;
    const { matchId, userId } = meta;
    meta.lastActivity = Date.now();

    const validChoices: Choice[] = ['rock', 'paper', 'scissors'];
    if (!validChoices.includes(data.choice)) return;

    const result = await this.matchesService.playRound(matchId, userId, data.choice);
    this.server.to(`match:${matchId}`).emit('round_result', {
      roundResult: result.roundResult,
      match: result.match,
      gameOver: result.gameOver,
      winnerId: result.winnerId,
    });

    if (result.gameOver) {
      this.server.to(`match:${matchId}`).emit('match_complete', { match: result.match });
      this.clientMap.delete(client.id);
      this.clearInactivityCheck(client.id);
    }
  }
}
