import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchesGateway } from './matches.gateway';
import { Match, MatchSchema } from './schemas/match.schema';
import { UsersModule } from '../users/users.module';
import { AvatarsModule } from '../avatars/avatars.module';
import { PowerUpsModule } from '../powerups/powerups.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Match.name, schema: MatchSchema }]),
    UsersModule,
    AvatarsModule,
    PowerUpsModule,
    AchievementsModule,
    TournamentsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesGateway],
  exports: [MatchesService],
})
export class MatchesModule {}
