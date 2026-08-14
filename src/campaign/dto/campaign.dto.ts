import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { CHOICES, POWERUP_IDS } from '../../common/constants/game';
import type { Choice, PowerUpId } from '../../common/constants/game';
import { MAX_EQUIPPED_POWERUPS } from '../../common/constants/game';

export class StartLevelDto {
  @IsInt()
  @Min(1)
  level: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EQUIPPED_POWERUPS)
  @IsIn(POWERUP_IDS as unknown as string[], { each: true })
  powerUps?: PowerUpId[];
}

export class PlayRoundDto {
  @IsIn(CHOICES as unknown as string[])
  choice: Choice;
}

export class UsePowerUpDto {
  @IsIn(POWERUP_IDS as unknown as string[])
  powerUpId: PowerUpId;
}

export class MapQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(40)
  count?: number;
}
