import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RankingsService } from './rankings.service';
import { RankingsController } from './rankings.controller';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [RankingsController],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}
