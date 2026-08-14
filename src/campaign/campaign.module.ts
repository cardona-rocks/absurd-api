import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import {
  CampaignLevel,
  CampaignLevelSchema,
} from './schemas/campaign-level.schema';
import { CampaignRun, CampaignRunSchema } from './schemas/campaign-run.schema';
import { Avatar, AvatarSchema } from '../avatars/schemas/avatar.schema';
import { AvatarsModule } from '../avatars/avatars.module';
import { UsersModule } from '../users/users.module';
import { PowerUpsModule } from '../powerups/powerups.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CampaignLevel.name, schema: CampaignLevelSchema },
      { name: CampaignRun.name, schema: CampaignRunSchema },
      { name: Avatar.name, schema: AvatarSchema },
    ]),
    AvatarsModule,
    UsersModule,
    PowerUpsModule,
    AchievementsModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
