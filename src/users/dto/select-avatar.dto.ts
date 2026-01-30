import { IsMongoId } from 'class-validator';

export class SelectAvatarDto {
  @IsMongoId()
  avatarId: string;
}
