import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettings } from './entities/platform-settings.entity';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformPublicController } from './platform-public.controller';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformSettings, User]),
  ],
  controllers: [PlatformSettingsController, PlatformPublicController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformModule {}

