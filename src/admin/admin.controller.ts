import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { AdminAvatarsService } from './admin-avatars.service';
import { AdminUsersService } from './admin-users.service';
import { AdminStatsService } from './admin-stats.service';
import { AuditService } from './audit.service';
import { UsersService } from '../users/users.service';
import { CreateAvatarDto, UpdateAvatarDto } from './dto/avatar.dto';
import {
  AdjustCreditsDto,
  BanUserDto,
  GrantAvatarDto,
  ModerationNoteDto,
  SetRoleDto,
} from './dto/moderation.dto';
import { CATEGORIES, SPRITE_TYPES } from '../common/constants/catalog';
import type { SpriteType } from '../common/constants/catalog';
import type { UploadedFile } from '../uploads/uploads.service';

/**
 * Panel de administración. Todo cuelga de /admin y exige rol de moderador como
 * mínimo; lo más sensible (roles, borrados) exige admin.
 */
@Controller('admin')
@UseGuards(RolesGuard)
@RequireRole('moderator')
export class AdminController {
  constructor(
    private avatars: AdminAvatarsService,
    private users: AdminUsersService,
    private stats: AdminStatsService,
    private audit: AuditService,
    private usersService: UsersService,
  ) {}

  /** Datos que el panel necesita al arrancar. */
  @Get('bootstrap')
  async bootstrap(@CurrentUser() actor: JwtPayload) {
    const me = await this.usersService.getOrThrow(actor.sub);
    return {
      me: {
        _id: me._id.toString(),
        name: me.name,
        email: me.email,
        role: me.role,
        mustChangePassword: me.mustChangePassword,
      },
      categories: CATEGORIES,
      spriteTypes: SPRITE_TYPES,
    };
  }

  // ------------------------------------------------------------ estadísticas

  @Get('stats')
  overview() {
    return this.stats.overview();
  }

  @Get('stats/timeline')
  timeline(
    @Query('days', new DefaultValuePipe(14), ParseIntPipe) days: number,
  ) {
    return this.stats.matchesTimeline(Math.min(Math.max(days, 1), 90));
  }

  @Get('stats/top-avatars')
  topAvatars(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.stats.topAvatars(Math.min(Math.max(limit, 1), 50));
  }

  // ---------------------------------------------------------------- avatares

  @Get('avatars')
  listAvatars(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.avatars.list({ search, category, page, limit });
  }

  @Get('avatars/:id')
  getAvatar(@Param('id') id: string) {
    return this.avatars.get(id);
  }

  @Post('avatars')
  createAvatar(@CurrentUser() actor: JwtPayload, @Body() dto: CreateAvatarDto) {
    return this.avatars.create(dto, { id: actor.sub, name: actor.email });
  }

  @Patch('avatars/:id')
  updateAvatar(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAvatarDto,
  ) {
    return this.avatars.update(id, dto, { id: actor.sub, name: actor.email });
  }

  @Delete('avatars/:id')
  @RequireRole('admin')
  deleteAvatar(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.avatars.remove(id, { id: actor.sub, name: actor.email });
  }

  /**
   * Sube una o varias imágenes a un tipo de sprite. Varias permiten animar.
   * El campo del formulario tiene que llamarse `files`.
   */
  @Post('avatars/:id/sprites/:type')
  @UseInterceptors(FilesInterceptor('files', 12))
  uploadSprites(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('type') type: SpriteType,
    @UploadedFiles() files: UploadedFile[],
  ) {
    return this.avatars.addSprites(id, type, files, {
      id: actor.sub,
      name: actor.email,
    });
  }

  @Delete('avatars/:id/sprites/:type/:filename')
  removeSprite(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('type') type: SpriteType,
    @Param('filename') filename: string,
  ) {
    return this.avatars.removeSprite(id, type, filename, {
      id: actor.sub,
      name: actor.email,
    });
  }

  @Patch('avatars/:id/sprites/:type/order')
  reorderSprites(
    @Param('id') id: string,
    @Param('type') type: SpriteType,
    @Body() body: { filenames: string[] },
  ) {
    return this.avatars.reorderSprites(id, type, body.filenames ?? []);
  }

  // ---------------------------------------------------------------- usuarios

  @Get('users')
  listUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('banned') banned?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit?: number,
  ) {
    return this.users.list({
      search,
      role,
      banned: banned === undefined ? undefined : banned === 'true',
      page,
      limit,
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Patch('users/:id/ban')
  banUser(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: BanUserDto,
  ) {
    return this.users.setBanned(id, dto.banned, dto.reason, {
      id: actor.sub,
      name: actor.email,
      role: actor.role,
    });
  }

  @Patch('users/:id/role')
  @RequireRole('admin')
  setRole(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.users.setRole(id, dto.role, {
      id: actor.sub,
      name: actor.email,
      role: actor.role,
    });
  }

  @Patch('users/:id/credits')
  adjustCredits(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdjustCreditsDto,
  ) {
    return this.users.adjustCredits(id, dto.amount, dto.reason, {
      id: actor.sub,
      name: actor.email,
      role: actor.role,
    });
  }

  @Post('users/:id/avatars')
  grantAvatar(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GrantAvatarDto,
  ) {
    return this.users.grantAvatar(id, dto.avatarId, {
      id: actor.sub,
      name: actor.email,
      role: actor.role,
    });
  }

  @Patch('users/:id/note')
  setNote(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ModerationNoteDto,
  ) {
    return this.users.setNote(id, dto.note, {
      id: actor.sub,
      name: actor.email,
      role: actor.role,
    });
  }

  @Post('users/:id/reset-password')
  @RequireRole('admin')
  resetPassword(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.users.resetPassword(id, {
      id: actor.sub,
      name: actor.email,
      role: actor.role,
    });
  }

  // ------------------------------------------------------------- auditoría

  @Get('audit')
  auditLog(
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.audit.list({ entity, entityId, page, limit });
  }
}
