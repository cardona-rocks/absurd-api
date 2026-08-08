import { Controller, Get, Param, Post } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  /** Catálogo de logros con el progreso del usuario. */
  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.achievementsService.listForUser(userId);
  }

  /** Reclama la recompensa en créditos de un logro desbloqueado. */
  @Post(':id/claim')
  claim(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.achievementsService.claim(userId, id);
  }
}
