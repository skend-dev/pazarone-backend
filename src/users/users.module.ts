import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersSeedService } from './users-seed.service';
import { User } from './entities/user.entity';
import { UserIdentity } from './entities/user-identity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserIdentity])],
  providers: [UsersService, UsersSeedService],
  exports: [UsersService, UsersSeedService],
})
export class UsersModule {}
