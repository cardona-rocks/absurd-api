import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @Length(3, 40)
  name: string;

  @IsOptional()
  @IsIn([4, 8])
  size?: number;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  entryFee?: number;
}

export class JoinTournamentDto {
  @IsOptional()
  @IsString()
  @Length(6, 6)
  joinCode?: string;
}
