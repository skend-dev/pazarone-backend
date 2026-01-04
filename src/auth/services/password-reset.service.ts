import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PasswordReset } from '../entities/password-reset.entity';
import { UsersService } from '../../users/users.service';
import { EmailService } from './email.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  /**
   * Generate password reset token and send email
   */
  async requestPasswordReset(email: string, baseUrl: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // Don't reveal if email exists or not (security best practice)
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      // Still return success to prevent email enumeration
      return;
    }

    // Invalidate any existing reset tokens for this user
    await this.passwordResetRepository.update(
      { userId: user.id, used: false },
      { used: true },
    );

    // Generate JWT token for password reset
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      type: 'password_reset',
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: '1h', // Password reset tokens expire in 1 hour
    });

    // Save reset token
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const passwordReset = this.passwordResetRepository.create({
      userId: user.id,
      email: user.email,
      token,
      expiresAt,
      used: false,
    });

    await this.passwordResetRepository.save(passwordReset);

    // Send password reset email
    const resetLink = `${baseUrl}/reset-password?token=${token}`;
    await this.emailService.sendPasswordReset(user.email, resetLink);

    this.logger.log(`Password reset email sent to ${email}`);
  }

  /**
   * Reset password using token
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<void> {
    // Find reset token
    const passwordReset = await this.passwordResetRepository.findOne({
      where: { token, used: false },
      relations: ['user'],
    });

    if (!passwordReset) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token is expired
    if (passwordReset.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Verify JWT token
    try {
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      });

      if (payload.type !== 'password_reset') {
        throw new BadRequestException('Invalid token type');
      }

      // Get user
      const user = await this.usersService.findOne(passwordReset.userId);

      // Update password (UsersService.updatePassword hashes it internally)
      await this.usersService.updatePassword(user.id, newPassword);

      // Mark token as used
      passwordReset.used = true;
      passwordReset.usedAt = new Date();
      await this.passwordResetRepository.save(passwordReset);

      this.logger.log(`Password reset successful for user ${user.email}`);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  /**
   * Clean up expired password reset tokens (can be called by a cron job)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.passwordResetRepository.delete({
      expiresAt: LessThan(new Date()),
      used: false,
    });
    this.logger.log(`Cleaned up ${result.affected || 0} expired password reset tokens`);
  }
}

