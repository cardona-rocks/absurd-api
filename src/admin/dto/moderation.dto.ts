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
import { ROLES } from '../../common/constants/roles';
import type { Role } from '../../common/constants/roles';

export class BanUserDto {
  @IsBoolean()
  banned: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  reason?: string;
}

export class SetRoleDto {
  @IsIn(ROLES as unknown as string[])
  role: Role;
}

export class AdjustCreditsDto {
  /** Positivo suma, negativo resta. */
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  amount: number;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  reason?: string;
}

export class ModerationNoteDto {
  @IsString()
  @Length(0, 1000)
  note: string;
}

export class GrantAvatarDto {
  @IsString()
  avatarId: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(6, 100)
  currentPassword: string;

  @IsString()
  @Length(6, 100)
  newPassword: string;
}
