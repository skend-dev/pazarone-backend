import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Use require for SendGrid to avoid TypeScript module resolution issues
const sgMail = require('@sendgrid/mail');

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'SENDGRID_API_KEY not configured. Email sending will fail.',
      );
    } else {
      sgMail.setApiKey(apiKey);
    }

    this.fromEmail =
      this.configService.get<string>('SENDGRID_FROM_EMAIL') ||
      'noreply@pazaro.com';
    this.fromName =
      this.configService.get<string>('SENDGRID_FROM_NAME') || 'Pazaro';
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: 'Verify your email - Pazaro',
      html: this.getVerificationCodeEmailTemplate(code),
      text: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.`,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Verification code sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification code to ${email}:`, error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendVerificationLink(
    email: string,
    verificationLink: string,
  ): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: 'Verify your email - Pazaro',
      html: this.getVerificationLinkEmailTemplate(verificationLink),
      text: `Click this link to verify your email: ${verificationLink}`,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Verification link sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification link to ${email}:`, error);
      throw new Error('Failed to send verification email');
    }
  }

  private getVerificationCodeEmailTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
            <h1 style="color: #2c3e50; margin-top: 0;">Verify Your Email</h1>
            <p>Thank you for using Pazaro! Please use the following code to verify your email address:</p>
            <div style="background-color: #fff; border: 2px dashed #3498db; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <h2 style="color: #3498db; font-size: 32px; letter-spacing: 8px; margin: 0;">${code}</h2>
            </div>
            <p style="color: #7f8c8d; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #7f8c8d; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
            <p style="color: #95a5a6; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Pazaro. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }

  private getVerificationLinkEmailTemplate(link: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
            <h1 style="color: #2c3e50; margin-top: 0;">Verify Your Email</h1>
            <p>Thank you for using Pazaro! Please click the button below to verify your email address:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" style="background-color: #3498db; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email</a>
            </div>
            <p style="color: #7f8c8d; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #7f8c8d; font-size: 12px; word-break: break-all;">${link}</p>
            <p style="color: #7f8c8d; font-size: 14px;">This link will expire in 24 hours.</p>
            <p style="color: #7f8c8d; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
            <p style="color: #95a5a6; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Pazaro. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }
}
