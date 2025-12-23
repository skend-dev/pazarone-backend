import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SellerSettingsService } from './seller-settings.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdatePaymentsDto } from './dto/update-payments.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('seller-settings')
@ApiBearerAuth('JWT-auth')
@Controller('seller/settings')
@UseGuards(JwtAuthGuard)
export class SellerSettingsController {
  constructor(private readonly settingsService: SellerSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get seller settings and profile' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSettings(@CurrentUser() user: User) {
    return this.settingsService.getSettings(user.id);
  }

  @Put('account')
  @ApiOperation({ summary: 'Update account information' })
  @ApiResponse({ status: 200, description: 'Account updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., email already in use)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateAccount(
    @CurrentUser() user: User,
    @Body() updateAccountDto: UpdateAccountDto,
  ) {
    return this.settingsService.updateAccount(user.id, updateAccountDto);
  }

  @Put('password')
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., passwords do not match)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (incorrect current password)',
  })
  updatePassword(
    @CurrentUser() user: User,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.settingsService.updatePassword(user.id, updatePasswordDto);
  }

  @Put('store')
  @ApiOperation({ summary: 'Update store information' })
  @ApiResponse({
    status: 200,
    description: 'Store information updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateStore(
    @CurrentUser() user: User,
    @Body() updateStoreDto: UpdateStoreDto,
  ) {
    return this.settingsService.updateStore(user.id, updateStoreDto);
  }

  @Put('payments')
  @ApiOperation({ summary: 'Update payment information' })
  @ApiResponse({
    status: 200,
    description: 'Payment information updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updatePayments(
    @CurrentUser() user: User,
    @Body() updatePaymentsDto: UpdatePaymentsDto,
  ) {
    return this.settingsService.updatePayments(user.id, updatePaymentsDto);
  }

  @Put('notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateNotifications(
    @CurrentUser() user: User,
    @Body() updateNotificationsDto: UpdateNotificationsDto,
  ) {
    return this.settingsService.updateNotifications(
      user.id,
      updateNotificationsDto,
    );
  }

  @Put('shipping')
  @ApiOperation({ summary: 'Update shipping countries' })
  @ApiResponse({
    status: 200,
    description: 'Shipping countries updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid country or empty array',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateShipping(
    @CurrentUser() user: User,
    @Body() updateShippingDto: UpdateShippingDto,
  ) {
    return this.settingsService.updateShipping(user.id, updateShippingDto);
  }

  @Post('verify-account')
  @ApiOperation({ summary: 'Verify seller account (for payment verification)' })
  @ApiResponse({
    status: 200,
    description: 'Verification request submitted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  verifyAccount(@CurrentUser() user: User) {
    return this.settingsService.verifyAccount(user.id);
  }
}
