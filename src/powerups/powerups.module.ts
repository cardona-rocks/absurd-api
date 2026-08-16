import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PowerUpsService } from './powerups.service';
import { PowerUpsController } from './powerups.controller';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [PowerUpsController],
  providers: [PowerUpsService],
  exports: [PowerUpsService],
})
export class PowerUpsModule {}
