import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { SelectAvatarDto } from './dto/select-avatar.dto';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { PurchaseAvatarDto } from './dto/purchase-avatar.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.usersService.getOrThrow(userId).then((u) => this.usersService.toResponse(u));
  }

  @Patch('me/avatar')
  selectAvatar(
    @CurrentUser('sub') userId: string,
    @Body() dto: SelectAvatarDto,
  ) {
    return this.usersService.setAvatar(userId, dto.avatarId).then((u) => this.usersService.toResponse(u));
  }

  @Post('me/avatars/purchase')
  purchaseAvatar(
    @CurrentUser('sub') userId: string,
    @Body() dto: PurchaseAvatarDto,
  ) {
    return this.usersService.purchaseAvatarById(userId, dto.avatarId).then((u) => this.usersService.toResponse(u));
  }

  @Patch('me/credits')
  purchaseCredits(
    @CurrentUser('sub') userId: string,
    @Body() dto: PurchaseCreditsDto,
  ) {
    return this.usersService.purchaseCredits(userId, dto.amount);
  }
}
