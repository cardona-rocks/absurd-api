import { Body, Controller, Get, Post } from '@nestjs/common';
import { PowerUpsService } from './powerups.service';
import { PurchasePowerUpDto } from './dto/purchase-powerup.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('powerups')
export class PowerUpsController {
  constructor(private readonly powerUpsService: PowerUpsService) {}

  /** Catálogo con lo que ya posee el usuario y si le alcanzan los créditos. */
  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.powerUpsService.listForUser(userId);
  }

  /** Solo el inventario, como mapa id -> cantidad. */
  @Get('inventory')
  inventory(@CurrentUser('sub') userId: string) {
    return this.powerUpsService.inventory(userId);
  }

  @Post('purchase')
  purchase(
    @CurrentUser('sub') userId: string,
    @Body() dto: PurchasePowerUpDto,
  ) {
    return this.powerUpsService.purchase(userId, dto.powerUpId, dto.quantity ?? 1);
  }
}
