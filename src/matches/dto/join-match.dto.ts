import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length } from 'class-validator';
import {
  POWERUP_IDS,
  MAX_EQUIPPED_POWERUPS,
} from '../../common/constants/game';
import type { PowerUpId } from '../../common/constants/game';

export class JoinMatchDto {
  /** Power ups a equipar en este combate. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EQUIPPED_POWERUPS)
  @IsIn(POWERUP_IDS as unknown as string[], { each: true })
  powerUps?: PowerUpId[];
}

export class JoinPrivateDto extends JoinMatchDto {
  @IsString()
  @Length(6, 6)
  roomCode: string;
}

export class UsePowerUpDto {
  @IsIn(POWERUP_IDS as unknown as string[])
  powerUpId: PowerUpId;
}
