import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AvatarsModule } from './avatars/avatars.module';
import { MatchesModule } from './matches/matches.module';
import { PowerUpsModule } from './powerups/powerups.module';
import { AchievementsModule } from './achievements/achievements.module';
import { RankingsModule } from './rankings/rankings.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { CampaignModule } from './campaign/campaign.module';
import { AdminModule } from './admin/admin.module';
import { UploadsModule } from './uploads/uploads.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
          throw new Error(
            'Falta MONGODB_URI. Copia .env.example a .env y pon tu cadena de conexión.',
          );
        }
        return { uri };
      },
    }),
    AuthModule,
    UsersModule,
    AvatarsModule,
    MatchesModule,
    PowerUpsModule,
    AchievementsModule,
    RankingsModule,
    TournamentsModule,
    CampaignModule,
    UploadsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
