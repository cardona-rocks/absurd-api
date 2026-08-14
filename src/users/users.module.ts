import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import {
  CreditPurchase,
  CreditPurchaseSchema,
} from './schemas/credit-purchase.schema';
import { AvatarsModule } from '../avatars/avatars.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: CreditPurchase.name, schema: CreditPurchaseSchema },
    ]),
    AvatarsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
