import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettings } from './entities/platform-settings.entity';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformPublicController } from './platform-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettings])],
  controllers: [PlatformSettingsController, PlatformPublicController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformModule {}

