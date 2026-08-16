import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JoinPrivateDto, UsePowerUpDto } from './dto/join-match.dto';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  /** Buscar rival: entra a un combate abierto o crea uno. */
  @Post('join')
  createOrJoin(@CurrentUser('sub') userId: string) {
    return this.matchesService.createOrJoin(userId);
  }

  /** Crea una sala privada y devuelve su código. */
  @Post('private')
  createPrivate(@CurrentUser('sub') userId: string) {
    return this.matchesService.createPrivate(userId);
  }

  /** Entra a una sala privada con su código. */
  @Post('private/join')
  joinPrivate(@CurrentUser('sub') userId: string, @Body() dto: JoinPrivateDto) {
    return this.matchesService.joinPrivate(userId, dto.roomCode);
  }

  /** Combate activo del usuario, para reconectar. */
  @Get('active')
  active(@CurrentUser('sub') userId: string) {
    return this.matchesService.activeForUser(userId);
  }

  /** Historial de combates terminados. */
  @Get('history')
  history(
    @CurrentUser('sub') userId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.matchesService.historyForUser(userId, limit);
  }

  @Get(':id')
  getMatch(@Param('id') matchId: string) {
    return this.matchesService.getMatch(matchId);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser('sub') userId: string, @Param('id') matchId: string) {
    return this.matchesService.cancelSearch(userId, matchId);
  }

  @Post(':id/forfeit')
  forfeit(@CurrentUser('sub') userId: string, @Param('id') matchId: string) {
    return this.matchesService.forfeit(matchId, userId, 'forfeit');
  }

  @Post(':id/rematch')
  rematch(@CurrentUser('sub') userId: string, @Param('id') matchId: string) {
    return this.matchesService.rematch(userId, matchId);
  }

  @Post(':id/powerup')
  usePowerUp(
    @CurrentUser('sub') userId: string,
    @Param('id') matchId: string,
    @Body() dto: UsePowerUpDto,
  ) {
    return this.matchesService.usePowerUp(matchId, userId, dto.powerUpId);
  }
}
