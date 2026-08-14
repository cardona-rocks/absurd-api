import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { LEVEL_KINDS } from '../../common/constants/campaign';
import type { LevelKind } from '../../common/constants/campaign';
import { ENEMY_CLASSES } from '../../common/constants/catalog';
import type { EnemyClass } from '../../common/constants/catalog';

/**
 * Campos comunes a una plantilla de ciclo y a una excepción de nivel.
 *
 * La diferencia entre ambas está sólo en `level`: null es plantilla, un número
 * es excepción para ese nivel exacto.
 */
export class UpdateCampaignLevelDto {
  @IsOptional()
  @IsString()
  @Length(0, 60)
  name?: string;

  @IsOptional()
  @IsIn(LEVEL_KINDS as unknown as string[])
  kind?: LevelKind;

  @IsOptional()
  @IsIn(ENEMY_CLASSES as unknown as string[])
  enemyClass?: EnemyClass;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  enemyCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  heartsPerEnemy?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  heartsPerEnemyAlt?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  playerHearts?: number;

  /** Enemigos fijados a mano. Vacío deja elegir a la campaña. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsMongoId({ each: true })
  enemies?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  notes?: string;
}

/** Crea una excepción para un nivel concreto. */
export class CreateLevelOverrideDto extends UpdateCampaignLevelDto {
  @IsInt()
  @Min(1)
  @Max(100_000)
  level: number;
}
