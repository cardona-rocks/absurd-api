import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import {
  POWERUP_IDS,
  MAX_EQUIPPED_POWERUPS,
} from '../../common/constants/game';
import type { PowerUpId } from '../../common/constants/game';

export class JoinMatchDto {
  /**
   * Se acepta pero se ignora: los power ups son exclusivos de la campaña.
   *
   * El campo se mantiene porque la validación rechaza propiedades desconocidas
   * (`forbidNonWhitelisted`), y quitarlo haría fallar con un 400 a las versiones
   * de la app que todavía lo envían.
   */
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
