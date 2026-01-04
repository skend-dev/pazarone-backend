import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import { AffiliateService } from './affiliate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserType } from '../users/entities/user.entity';
import { ForbiddenException } from '@nestjs/common';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { VerifyPaymentMethodOtpDto } from './dto/verify-payment-method-otp.dto';

@ApiTags('affiliate-settings')
@ApiBearerAuth('JWT-auth')
@Controller('affiliate')
@UseGuards(JwtAuthGuard)
export class AffiliateSettingsController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly affiliateService: AffiliateService,
  ) {}

  private validateAffiliate(user: User) {
    if (user.userType !== UserType.AFFILIATE) {
      throw new ForbiddenException(
        'This endpoint is only available for affiliate users',
      );
    }
  }

  @Get('platform-settings')
  @ApiOperation({
    summary: 'Get platform settings for affiliates and sellers',
    description: 'Returns minimum withdrawal threshold, affiliate commission range, bank transfer details, and other platform settings. Available to affiliates and sellers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform settings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
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
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - affiliate or seller access required' })
  async getPlatformSettings(@CurrentUser() user: User) {
    // Allow both affiliates and sellers to access platform settings
    if (user.userType !== UserType.AFFILIATE && user.userType !== UserType.SELLER) {
      throw new ForbiddenException(
        'This endpoint is only available for affiliate or seller users',
      );
    }

    const settings = await this.platformSettingsService.getSettings();
    return {
      affiliateMinWithdrawalThreshold: parseFloat(
        settings.affiliateMinWithdrawalThreshold.toString(),
      ),
      affiliateCommissionMin: parseFloat(
        settings.affiliateCommissionMin.toString(),
      ),
      affiliateCommissionMax: parseFloat(
        settings.affiliateCommissionMax.toString(),
      ),
      platformFeePercent: settings.platformFeePercent
        ? parseFloat(settings.platformFeePercent.toString())
        : undefined,
      bankTransferDetails: settings.bankTransferDetails || undefined,
    };
  }

  @Get('payment-method')
  @ApiOperation({
    summary: 'Get payment method',
    description: 'Returns the affiliate payment method information',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid' },
        bankName: { type: 'string', example: 'Halkbank' },
        accountNumber: { type: 'string', example: '****1234' },
        accountHolderName: { type: 'string', example: 'Skender Mustafa' },
        iban: { type: 'string', nullable: true, example: 'MK07250120000058984' },
        swiftCode: { type: 'string', nullable: true, example: 'HALKMK22' },
        bankAddress: { type: 'string', nullable: true },
        verified: { type: 'boolean', example: false },
        verificationNotes: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - affiliate access required' })
  async getPaymentMethod(@CurrentUser() user: User) {
    this.validateAffiliate(user);
    const paymentMethod = await this.affiliateService.getPaymentMethod(user.id);
    return paymentMethod;
  }

  @Post('payment-method')
  @ApiOperation({
    summary: 'Create or update payment method',
    description: 'Creates or updates the affiliate payment method. Verification is reset when updated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method saved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid' },
        bankName: { type: 'string', example: 'Halkbank' },
        accountNumber: { type: 'string', example: '****1234' },
        accountHolderName: { type: 'string', example: 'Skender Mustafa' },
        iban: { type: 'string', nullable: true },
        swiftCode: { type: 'string', nullable: true },
        bankAddress: { type: 'string', nullable: true },
        verified: { type: 'boolean', example: false },
        verificationNotes: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - affiliate access required' })
  async updatePaymentMethod(
    @CurrentUser() user: User,
    @Body() updatePaymentMethodDto: UpdatePaymentMethodDto,
  ) {
    this.validateAffiliate(user);
    return this.affiliateService.updatePaymentMethod(
      user.id,
      updatePaymentMethodDto,
    );
  }

  @Put('payment-method')
  @ApiOperation({
    summary: 'Update payment method (alias for POST)',
    description: 'Updates the affiliate payment method. Verification is reset when updated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - affiliate access required' })
  async updatePaymentMethodPut(
    @CurrentUser() user: User,
    @Body() updatePaymentMethodDto: UpdatePaymentMethodDto,
  ) {
    this.validateAffiliate(user);
    return this.affiliateService.updatePaymentMethod(
      user.id,
      updatePaymentMethodDto,
    );
  }

  @Post('payment-method/send-otp')
  @ApiOperation({
    summary: 'Send OTP for payment method verification',
    description:
      'Sends a 6-digit OTP code to the affiliate email to verify payment method ownership',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP code sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'OTP code sent to your email',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - payment method not found',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - affiliate access required' })
  async sendPaymentMethodOtp(@CurrentUser() user: User) {
    this.validateAffiliate(user);
    await this.affiliateService.sendPaymentMethodOtp(user.id);
    return {
      success: true,
      message: 'OTP code sent to your email',
    };
  }

  @Post('payment-method/verify-otp')
  @ApiOperation({
    summary: 'Verify OTP code to confirm user identity',
    description:
      'Verifies the OTP code sent to email to confirm user identity. Payment method verification is done separately by admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'User identity confirmed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example:
            'User identity confirmed successfully. Payment method is pending admin verification.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid or expired OTP code',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - affiliate access required' })
  async verifyPaymentMethodOtp(
    @CurrentUser() user: User,
    @Body() verifyOtpDto: VerifyPaymentMethodOtpDto,
  ) {
    this.validateAffiliate(user);
    return this.affiliateService.verifyPaymentMethodOtp(
      user.id,
      verifyOtpDto,
    );
  }
}

