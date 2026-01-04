import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('admin-platform-settings')
@ApiBearerAuth('JWT-auth')
@Controller('admin/platform-settings')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class PlatformSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}


  @Get()
  @ApiOperation({
    summary: 'Get platform settings',
    description: 'Returns current platform settings (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform settings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid' },
        key: { type: 'string', example: 'main' },
        affiliateMinWithdrawalThreshold: { type: 'number', example: 1000 },
        affiliateCommissionMin: { type: 'number', example: 0 },
        affiliateCommissionMax: { type: 'number', example: 100 },
        platformFeePercent: { type: 'number', example: 7.0 },
        bankTransferDetails: {
          type: 'object',
          properties: {
            bankName: { type: 'string', example: 'Komercijalna Banka AD Skopje' },
            accountNumber: { type: 'string', example: '1234567890123' },
            accountHolder: { type: 'string', example: 'PazarOne DOOEL' },
            iban: { type: 'string', example: 'MK07250120000058984' },
            swift: { type: 'string', example: 'KOBSMK2X' },
            reference: { type: 'string', example: 'INV-{invoiceNumber}' },
          },
        },
        createdAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        updatedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async getSettings(@CurrentUser() user: User) {
    return this.platformSettingsService.getSettings();
  }

  @Put()
  @ApiOperation({
    summary: 'Update platform settings',
    description: 'Update platform settings such as minimum withdrawal threshold and platform fee (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform settings updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid' },
        key: { type: 'string', example: 'main' },
        affiliateMinWithdrawalThreshold: { type: 'number', example: 1500 },
        affiliateCommissionMin: { type: 'number', example: 0 },
        affiliateCommissionMax: { type: 'number', example: 100 },
        platformFeePercent: { type: 'number', example: 7.5 },
        bankTransferDetails: {
          type: 'object',
          properties: {
            bankName: { type: 'string', example: 'Komercijalna Banka AD Skopje' },
            accountNumber: { type: 'string', example: '1234567890123' },
            accountHolder: { type: 'string', example: 'PazarOne DOOEL' },
            iban: { type: 'string', example: 'MK07250120000058984' },
            swift: { type: 'string', example: 'KOBSMK2X' },
            reference: { type: 'string', example: 'INV-{invoiceNumber}' },
          },
        },
        createdAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        updatedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async updateSettings(
    @CurrentUser() user: User,
    @Body() updatePlatformSettingsDto: UpdatePlatformSettingsDto,
  ) {
    return this.platformSettingsService.updateSettings(updatePlatformSettingsDto);
  }
}

