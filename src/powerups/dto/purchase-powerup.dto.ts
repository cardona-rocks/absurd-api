import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { POWERUP_IDS } from '../../common/constants/game';
import type { PowerUpId } from '../../common/constants/game';

export class PurchasePowerUpDto {
  @IsIn(POWERUP_IDS as unknown as string[])
  powerUpId: PowerUpId;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  quantity?: number;
}
