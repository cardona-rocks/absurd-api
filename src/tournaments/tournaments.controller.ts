import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTournamentDto, JoinTournamentDto } from './dto/tournament.dto';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  /** Torneos públicos abiertos o en curso. */
  @Get()
  list() {
    return this.tournamentsService.listOpen();
  }

  /** Torneos en los que participa el usuario. */
  @Get('mine')
  mine(@CurrentUser('sub') userId: string) {
    return this.tournamentsService.mine(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateTournamentDto) {
    return this.tournamentsService.create(userId, {
      name: dto.name,
      size: dto.size ?? 8,
      isPrivate: dto.isPrivate ?? false,
      entryFee: dto.entryFee ?? 0,
    });
  }

  @Post(':id/join')
  join(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: JoinTournamentDto,
  ) {
    return this.tournamentsService.join(userId, id, dto?.joinCode);
  }

  @Post(':id/leave')
  leave(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.tournamentsService.leave(userId, id);
  }

  /** Crea o recupera el combate del cruce pendiente del usuario. */
  @Post(':id/play')
  play(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.tournamentsService.playNext(userId, id);
  }
}
