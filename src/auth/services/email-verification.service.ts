import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailVerification } from '../entities/email-verification.entity';
import { EmailService } from './email.service';

@Injectable()
export class EmailVerificationService {
  private readonly CODE_EXPIRY_MINUTES = 10;
  private readonly TOKEN_EXPIRY_HOURS = 24;

  constructor(
    @InjectRepository(EmailVerification)
    private emailVerificationRepository: Repository<EmailVerification>,
    private emailService: EmailService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate a 6-digit verification code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Check if an email is already verified
   */
  async isEmailVerified(email: string): Promise<boolean> {
    const verification = await this.emailVerificationRepository.findOne({
      where: {
        email,
        verified: true,
      },
      order: {
        verifiedAt: 'DESC',
      },
    });

    return !!verification;
  }

  /**
   * Send verification code to email
   */
  async sendVerificationCode(email: string): Promise<void> {
    // Check if email is already verified
    const isVerified = await this.isEmailVerified(email);
    if (isVerified) {
      // Email is already verified, no need to send code
      return;
    }

    // Invalidate any existing unverified codes for this email
    await this.emailVerificationRepository.update(
      {
        email,
        verified: false,
      },
      {
        verified: true, // Mark as used (not verified, but invalidated)
      },
    );

    // Generate new code
    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.CODE_EXPIRY_MINUTES);

    // Create verification record
    const verification = this.emailVerificationRepository.create({
      email,
      code,
      expiresAt,
      verified: false,
    });

    await this.emailVerificationRepository.save(verification);

    // Send email
    await this.emailService.sendVerificationCode(email, code);
  }

  /**
   * Verify email with 6-digit code and return verification token
   */
  async verifyEmail(email: string, code: string): Promise<string> {
    // Find the most recent unverified code for this email
    const verification = await this.emailVerificationRepository.findOne({
      where: {
        email,
        code,
        verified: false,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!verification) {
      throw new BadRequestException('Invalid verification code');
    }

    // Check if code is expired
    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('Verification code has expired');
    }

    // Mark as verified
    verification.verified = true;
    verification.verifiedAt = new Date();
    await this.emailVerificationRepository.save(verification);

    // Generate verification token (JWT)
    const token = await this.generateVerificationToken(email);

    return token;
  }

  /**
   * Generate verification token for email link
   */
  async generateVerificationLink(email: string): Promise<string> {
    // Invalidate any existing unverified tokens for this email
    await this.emailVerificationRepository
      .createQueryBuilder()
      .update(EmailVerification)
      .set({ verified: true })
      .where('email = :email', { email })
      .andWhere('verified = :verified', { verified: false })
      .andWhere('token IS NOT NULL')
      .execute();

    // Generate token
    const token = await this.generateVerificationToken(email);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

    // Create verification record
    const verification = this.emailVerificationRepository.create({
      email,
      code: '', // Not used for link verification
      token,
      expiresAt,
      verified: false,
    });

    await this.emailVerificationRepository.save(verification);

    return token;
  }

  /**
   * Send verification link email
   */
  async sendVerificationLink(email: string, baseUrl: string): Promise<void> {
    const token = await this.generateVerificationLink(email);
    const verificationLink = `${baseUrl}/verify-email?token=${token}`;
    await this.emailService.sendVerificationLink(email, verificationLink);
  }

  /**
   * Verify email via link token
   */
  async verifyEmailLink(token: string): Promise<{ email: string }> {
    try {
      // Verify JWT token
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      });

      if (payload.type !== 'email_verification' || !payload.email) {
        throw new UnauthorizedException('Invalid verification token');
      }

      const email = payload.email;

      // Find verification record
      const verification = await this.emailVerificationRepository.findOne({
        where: {
          email,
          token,
          verified: false,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (!verification) {
        throw new BadRequestException(
          'Verification link not found or already used',
        );
      }

      // Check if token is expired
      if (new Date() > verification.expiresAt) {
        throw new BadRequestException('Verification link has expired');
      }

      // Mark as verified
      verification.verified = true;
      verification.verifiedAt = new Date();
      await this.emailVerificationRepository.save(verification);

      return { email };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new BadRequestException('Invalid verification token');
    }
  }

  /**
   * Validate verification token (for order creation)
   */
  async validateVerificationToken(token: string): Promise<{ email: string }> {
    try {
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      });

      if (payload.type !== 'email_verification' || !payload.email) {
        throw new UnauthorizedException('Invalid verification token');
      }

      const email = payload.email;

      // Check if email was verified
      const verification = await this.emailVerificationRepository.findOne({
        where: {
          email,
          verified: true,
        },
        order: {
          verifiedAt: 'DESC',
        },
      });

      if (!verification) {
        throw new UnauthorizedException('Email not verified');
      }

      return { email };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid verification token');
    }
  }

  /**
   * Generate JWT verification token
   */
  private async generateVerificationToken(email: string): Promise<string> {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload = {
      email,
      type: 'email_verification',
    };

    return this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: '24h',
    });
  }

  /**
   * Clean up expired verification records (can be called by a cron job)
   */
  async cleanupExpiredVerifications(): Promise<void> {
    const result = await this.emailVerificationRepository.delete({
      expiresAt: LessThan(new Date()),
      verified: false,
    });
    // Log cleanup if needed
  }
}
