import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AffiliateService } from './affiliate.service';

@ApiTags('affiliate-public')
@Controller('affiliate')
export class AffiliatePublicController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Get('track/:referralCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track referral link click',
    description: 'Increments the click count for a referral code. This endpoint can be called when a user clicks on an affiliate link.',
  })
  @ApiParam({
    name: 'referralCode',
    description: 'Affiliate referral code',
    example: 'AFF-ABC123',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral click tracked successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Referral click tracked' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Referral code not found' })
  async trackReferralClick(@Param('referralCode') referralCode: string) {
    await this.affiliateService.trackReferralClick(referralCode);
    return {
      success: true,
      message: 'Referral click tracked',
    };
  }

  @Get('verify/:referralCode')
  @ApiOperation({
    summary: 'Verify referral code',
    description: 'Checks if a referral code is valid and active',
  })
  @ApiParam({
    name: 'referralCode',
    description: 'Affiliate referral code',
    example: 'AFF-ABC123',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral code is valid',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        referralCode: { type: 'string', example: 'AFF-ABC123' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Referral code not found or inactive' })
  async verifyReferralCode(@Param('referralCode') referralCode: string) {
    const affiliate = await this.affiliateService.getAffiliateByReferralCode(referralCode);
    if (!affiliate) {
      return {
        valid: false,
        message: 'Referral code not found or inactive',
      };
    }
    return {
      valid: true,
      referralCode,
    };
  }
}

