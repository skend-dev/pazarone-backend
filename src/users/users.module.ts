import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersSeedService } from './users-seed.service';
import { User } from './entities/user.entity';
import { UserIdentity } from './entities/user-identity.entity';
import { MarketingModule } from '../marketing/marketing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserIdentity]),
    forwardRef(() => MarketingModule),
  ],
  providers: [UsersService, UsersSeedService],
  exports: [UsersService, UsersSeedService],
})
export class UsersModule {}
