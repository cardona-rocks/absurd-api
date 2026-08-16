import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { PlayRoundDto, StartLevelDto, UsePowerUpDto } from './dto/campaign.dto';

/**
 * Modo campaña: un jugador contra las criaturas del sistema.
 *
 * Es REST y no websocket porque no hay nadie al otro lado esperando: cada
 * jugada es una petición que el servidor resuelve y contesta. Lo que no cambia
 * es quién manda: la app envía la jugada, nunca el resultado.
 */
@Controller('campaign')
export class CampaignController {
  constructor(private campaign: CampaignService) {}

  /** Progreso del jugador y los siguientes niveles. */
  @Get('map')
  async map(
    @CurrentUser() user: JwtPayload,
    @Query('count', new DefaultValuePipe(12), ParseIntPipe) count: number,
  ) {
    return this.campaign.map(user.sub, Math.min(Math.max(count, 1), 40));
  }

  /** Qué plantea un nivel concreto, sin empezarlo. */
  @Get('levels/:level')
  async level(@Param('level', ParseIntPipe) level: number) {
    return this.campaign.playerLevel(level);
  }

  /** El intento en curso, si el jugador dejó uno a medias. */
  @Get('active')
  async active(@CurrentUser() user: JwtPayload) {
    return this.campaign.active(user.sub);
  }

  @Get('history')
  async history(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.campaign.history(user.sub, limit);
  }

  @Post('start')
  async start(@CurrentUser() user: JwtPayload, @Body() dto: StartLevelDto) {
    return this.campaign.start(user.sub, dto.level, dto.powerUps ?? []);
  }

  @Post('runs/:id/play')
  async play(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PlayRoundDto,
  ) {
    return this.campaign.play(id, user.sub, dto.choice);
  }

  @Post('runs/:id/powerup')
  async powerUp(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UsePowerUpDto,
  ) {
    return this.campaign.usePowerUp(id, user.sub, dto.powerUpId);
  }

  @Post('runs/:id/forfeit')
  async forfeit(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.campaign.forfeit(id, user.sub);
  }

  @Get('runs/:id')
  async run(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.campaign.getRun(id, user.sub);
  }
}
