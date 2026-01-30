import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post('join')
  createOrJoin(@CurrentUser('sub') userId: string) {
    return this.matchesService.createOrJoin(userId);
  }

  @Get(':id')
  getMatch(@Param('id') matchId: string) {
    return this.matchesService.getMatch(matchId);
  }
}
