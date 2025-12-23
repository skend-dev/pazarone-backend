import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersSeedService } from './users-seed.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, UsersSeedService],
  exports: [UsersService, UsersSeedService],
})
export class UsersModule {}
