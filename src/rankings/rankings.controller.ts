import { Controller, Get, ParseIntPipe, Query, DefaultValuePipe } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  /** Top global + la posición del usuario actual aunque no esté en el top. */
  @Get()
  leaderboard(
    @CurrentUser('sub') userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.rankingsService.leaderboard(userId, limit);
  }
}
