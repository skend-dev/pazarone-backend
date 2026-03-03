import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { FirebaseAuthDto } from './dto/firebase-auth.dto';
import { SendVerificationEmailDto } from './dto/send-verification-email.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { VerifyEmailResponseDto } from './dto/verify-email-response.dto';
import { CheckEmailVerifiedDto } from './dto/check-email-verified.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpgradeRoleDto } from './dto/upgrade-role.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordResetService } from './services/password-reset.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user (seller or affiliate)' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request (validation error)' })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async signup(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('firebase')
  @Throttle({ medium: { limit: 15, ttl: 10000 } })
  @ApiOperation({
    summary: 'Sign in with Firebase (Google/Apple)',
    description:
      'Exchanges a Firebase ID token for backend JWT. Verifies token server-side, then finds or creates user and links identity. Supports account linking by email.',
  })
  @ApiResponse({
    status: 201,
    description: 'Signed in successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', nullable: true },
            name: { type: 'string' },
            providers: {
              type: 'array',
              items: { type: 'string' },
              example: ['google'],
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (invalid body or Firebase not configured)',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired Firebase ID token',
  })
  async signInWithFirebase(@Body() dto: FirebaseAuthDto) {
    return this.authService.signInWithFirebase(
      dto.idToken,
      dto.device,
      dto.userType,
      dto.market,
      dto.referralCode,
    );
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user information' })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        email: { type: 'string', example: 'user@example.com' },
        name: { type: 'string', example: 'John Doe' },
        userType: {
          type: 'string',
          enum: ['seller', 'affiliate', 'customer'],
          example: 'seller',
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        providers: {
          type: 'array',
          items: { type: 'string' },
          description:
            'OAuth providers linked to this account (e.g. google, apple). Empty for email/password-only.',
        },
        requiresSetPassword: {
          type: 'boolean',
          description:
            'True when user has OAuth providers but has not yet set a platform password. Show "Set password" form instead of "Change password".',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: User) {
    const providers = await this.usersService.getProvidersForUser(user.id);
    const requiresSetPassword =
      providers.length > 0 && !user.hasPlatformPassword;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      providers,
      requiresSetPassword,
    };
  }

  @Post('set-password')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Set password for OAuth-only accounts',
    description:
      'Allows users who signed up with Google or Apple to set a platform password. Not allowed for email/password-only accounts (use change password instead).',
  })
  @ApiResponse({
    status: 200,
    description: 'Password set successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password set successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Set password is only for accounts that signed in with Google or Apple',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setPassword(@CurrentUser() user: User, @Body() dto: SetPasswordDto) {
    return this.authService.setPassword(user, dto);
  }

  @Post('upgrade-role')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Upgrade customer to seller or affiliate',
    description:
      'Allows a customer to become a seller or affiliate. Returns new tokens and user. Market (MK/KS) is required when upgrading to seller.',
  })
  @ApiResponse({
    status: 200,
    description: 'Role upgraded successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Only customers can upgrade their role',
  })
  @ApiResponse({ status: 400, description: 'Market required for seller' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async upgradeRole(@CurrentUser() user: User, @Body() dto: UpgradeRoleDto) {
    return this.authService.upgradeRole(
      user,
      dto.userType,
      dto.market,
      dto.referralCode,
    );
  }

  @Post('send-verification-email')
  @ApiOperation({
    summary: 'Send verification email with 6-digit code',
    description:
      'Sends a 6-digit verification code to the provided email address',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
  async sendVerificationEmail(
    @Body() sendVerificationEmailDto: SendVerificationEmailDto,
  ) {
    await this.emailVerificationService.sendVerificationCode(
      sendVerificationEmailDto.email,
    );
    return { message: 'Verification code sent successfully' };
  }

  @Post('verify-email')
  @ApiOperation({
    summary: 'Verify email with 6-digit code',
    description:
      'Verifies the email address using the 6-digit code and returns a verification token',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    type: VerifyEmailResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    const verificationToken = await this.emailVerificationService.verifyEmail(
      verifyEmailDto.email,
      verifyEmailDto.code,
    );
    return {
      verificationToken,
      email: verifyEmailDto.email,
    };
  }

  @Post('register-customer')
  @ApiOperation({
    summary: 'Register a new customer with email verification',
    description:
      'Registers a new customer account using a verified email and verification token',
  })
  @ApiResponse({
    status: 201,
    description: 'Customer registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid verification token or email not verified',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async registerCustomer(@Body() registerCustomerDto: RegisterCustomerDto) {
    return this.authService.registerCustomer(registerCustomerDto);
  }

  @Get('verify-email-link')
  @ApiOperation({
    summary: 'Verify email via link token',
    description: 'Verifies email address using a token from email link',
  })
  @ApiQuery({
    name: 'token',
    description: 'Verification token from email link',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        message: { type: 'string', example: 'Email verified successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmailLink(@Query('token') token: string) {
    const { email } =
      await this.emailVerificationService.verifyEmailLink(token);
    return {
      email,
      message: 'Email verified successfully',
    };
  }

  @Post('check-email-verified')
  @ApiOperation({
    summary: 'Check if email is verified',
    description:
      'Checks if an email address has been verified previously. Returns true if verified, false otherwise.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verification status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        verified: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
  async checkEmailVerified(
    @Body() checkEmailVerifiedDto: CheckEmailVerifiedDto,
  ) {
    const isVerified = await this.emailVerificationService.isEmailVerified(
      checkEmailVerifiedDto.email,
    );
    return {
      email: checkEmailVerifiedDto.email,
      verified: isVerified,
    };
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Send password reset email to the user',
  })
  @ApiQuery({
    name: 'baseUrl',
    required: false,
    type: String,
    description:
      'Frontend URL for password reset link (defaults to FRONTEND_URL env var or http://localhost:3000)',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully (if email exists)',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'If the email exists, a password reset link has been sent',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Query('baseUrl') baseUrl?: string,
  ) {
    const frontendUrl =
      baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    await this.passwordResetService.requestPasswordReset(
      forgotPasswordDto.email,
      frontendUrl,
    );
    return {
      message:
        'If the email exists, a password reset link has been sent. Please check your email.',
    };
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password using token',
    description: 'Reset password using the token from password reset email',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Password has been reset successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid token, expired token, or passwords do not match',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    await this.passwordResetService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );

    return {
      message: 'Password has been reset successfully',
    };
  }
}
