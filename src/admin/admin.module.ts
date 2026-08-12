import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminAvatarsService } from './admin-avatars.service';
import { AdminUsersService } from './admin-users.service';
import { AdminStatsService } from './admin-stats.service';
import { AuditService } from './audit.service';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Avatar, AvatarSchema } from '../avatars/schemas/avatar.schema';
import { Match, MatchSchema } from '../matches/schemas/match.schema';
import {
  Tournament,
  TournamentSchema,
} from '../tournaments/schemas/tournament.schema';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: User.name, schema: UserSchema },
      { name: Avatar.name, schema: AvatarSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Tournament.name, schema: TournamentSchema },
    ]),
    UploadsModule,
    UsersModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminAvatarsService,
    AdminUsersService,
    AdminStatsService,
    AuditService,
  ],
  exports: [AuditService],
})
export class AdminModule {}
