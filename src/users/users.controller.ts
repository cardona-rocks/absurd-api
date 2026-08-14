import { Controller, Get, Patch, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SelectAvatarDto } from './dto/select-avatar.dto';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { PurchaseAvatarDto } from './dto/purchase-avatar.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser('sub') userId: string) {
    const user = await this.usersService.getOrThrow(userId);
    return this.usersService.toResponse(user);
  }

  /** Colección de avatares comprados por el usuario. */
  @Get('me/collection')
  async collection(@CurrentUser('sub') userId: string) {
    const user = await this.usersService.getOrThrow(userId);
    return user.collection;
  }

  /** Historial de compras de créditos. */
  @Get('me/credits/history')
  creditHistory(@CurrentUser('sub') userId: string) {
    return this.usersService.creditHistory(userId);
  }

  @Patch('me/avatar')
  async selectAvatar(
    @CurrentUser('sub') userId: string,
    @Body() dto: SelectAvatarDto,
  ) {
    const user = await this.usersService.setAvatar(userId, dto.avatarId);
    return this.usersService.toResponse(user);
  }

  @Post('me/avatars/purchase')
  async purchaseAvatar(
    @CurrentUser('sub') userId: string,
    @Body() dto: PurchaseAvatarDto,
  ) {
    const user = await this.usersService.purchaseAvatarById(
      userId,
      dto.avatarId,
    );
    return this.usersService.toResponse(user);
  }

  @Patch('me/credits')
  purchaseCredits(
    @CurrentUser('sub') userId: string,
    @Body() dto: PurchaseCreditsDto,
  ) {
    return this.usersService.purchaseCredits(userId, dto.amount);
  }
}
