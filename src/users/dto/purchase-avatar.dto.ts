import { IsMongoId } from 'class-validator';

export class PurchaseAvatarDto {
  @IsMongoId()
  avatarId: string;
}
