import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CATEGORIES,
  ENEMY_CLASSES,
  SPRITE_TYPES,
} from '../../common/constants/catalog';
import type {
  Category,
  EnemyClass,
  SpriteType,
} from '../../common/constants/catalog';

/** Ficha de enemigo. Sólo tiene sentido si `category` es 'Enemy'. */
export class EnemyFieldsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  level?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  hearts?: number;

  @IsOptional()
  @IsIn(ENEMY_CLASSES as unknown as string[])
  class?: EnemyClass;

  /** 0 = puro azar, 1 = siempre responde a la manía del jugador. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  counterRate?: number;
}

export class SpriteImageDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsInt()
  size?: number;
}

export class SpritesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpriteImageDto)
  front?: SpriteImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpriteImageDto)
  back?: SpriteImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpriteImageDto)
  default?: SpriteImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpriteImageDto)
  win?: SpriteImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpriteImageDto)
  lose?: SpriteImageDto[];
}

export class CreateAvatarDto {
  @IsString()
  @Length(2, 40)
  name: string;

  @IsString()
  @Length(2, 40)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'El slug solo admite minúsculas, números y guiones',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @Length(0, 600)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  tagline?: string;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  ability?: string;

  @IsIn(CATEGORIES as unknown as string[])
  category: Category;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  price: number;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsBoolean()
  retired?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SpritesDto)
  sprites?: SpritesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnemyFieldsDto)
  enemy?: EnemyFieldsDto;
}

export class UpdateAvatarDto {
  @IsOptional()
  @IsString()
  @Length(2, 40)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'El slug solo admite minúsculas, números y guiones',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(0, 600)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  tagline?: string;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  ability?: string;

  @IsOptional()
  @IsIn(CATEGORIES as unknown as string[])
  category?: Category;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  price?: number;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsBoolean()
  retired?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SpritesDto)
  sprites?: SpritesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnemyFieldsDto)
  enemy?: EnemyFieldsDto;
}

export class UploadSpriteQueryDto {
  @IsIn(SPRITE_TYPES as unknown as string[])
  type: SpriteType;
}
