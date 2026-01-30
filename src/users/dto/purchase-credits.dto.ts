import { IsInt, Min } from 'class-validator';

export class PurchaseCreditsDto {
  @IsInt()
  @Min(1)
  amount: number;
}
