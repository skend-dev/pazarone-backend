import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Use require for SendGrid to avoid TypeScript module resolution issues
const sgMail = require('@sendgrid/mail');

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly replyToEmail: string;
  private readonly frontendUrl: string;
  private readonly logoUrl: string | null;

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
      'noreply@pazarone.co';
    this.fromName =
      this.configService.get<string>('SENDGRID_FROM_NAME') || 'PazarOne';
    this.replyToEmail =
      this.configService.get<string>('SENDGRID_REPLY_TO_EMAIL') ||
      'support@pazarone.co';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://pazarone.co';
    this.logoUrl =
      this.configService.get<string>('EMAIL_LOGO_URL') || null;
  }

  /**
   * Generate standard email headers for better deliverability
   */
  private getEmailHeaders(email: string): Record<string, string> {
    return {
      'List-Unsubscribe': `<${this.frontendUrl}/unsubscribe?email=${encodeURIComponent(email)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }

  /**
   * Generate logo HTML for email header
   * Logo should be optimized for email: PNG format, max 180px width, hosted on reliable CDN
   */
  private getLogoHtml(): string {
    if (!this.logoUrl) {
      return '';
    }
    return `
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0;">
        <a href="${this.frontendUrl}" style="display: inline-block; text-decoration: none;">
          <img src="${this.logoUrl}" alt="PazarOne" style="max-width: 180px; height: auto; display: block; margin: 0 auto; border: 0;" />
        </a>
      </div>
    `;
  }

  /**
   * Generate improved footer with business identity and reason for email
   */
  private getEmailFooter(reason: string): string {
    return `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 13px; line-height: 1.8;">
        <p style="margin: 0 0 8px 0;"><strong>PazarOne</strong></p>
        <p style="margin: 0 0 8px 0;">Official platform: <a href="${this.frontendUrl}" style="color: #3498db; text-decoration: none;">${this.frontendUrl}</a></p>
        <p style="margin: 0 0 8px 0;">Support: <a href="mailto:${this.replyToEmail}" style="color: #3498db; text-decoration: none;">${this.replyToEmail}</a></p>
        <p style="margin: 8px 0 0 0; color: #999; font-size: 12px;">You received this email because ${reason}.</p>
      </div>
    `;
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      replyTo: this.replyToEmail,
      subject: 'Verify your email - PazarOne',
      html: this.getVerificationCodeEmailTemplate(code),
      text: `PazarOne – Email Verification

Your verification code is: ${code}

This code expires in 10 minutes.

You received this email because you signed up on PazarOne.
If this wasn't you, ignore this message.
Support: ${this.replyToEmail}`,
      headers: this.getEmailHeaders(email),
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
      replyTo: this.replyToEmail,
      subject: 'Verify your email - PazarOne',
      html: this.getVerificationLinkEmailTemplate(verificationLink),
      text: `PazarOne – Email Verification

Click this link to verify your email:
${verificationLink}

This link expires in 24 hours.

You received this email because you signed up on PazarOne.
If this wasn't you, ignore this message.
Support: ${this.replyToEmail}`,
      headers: this.getEmailHeaders(email),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Verification link sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification link to ${email}:`, error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendPaymentMethodVerificationCode(
    email: string,
    code: string,
  ): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      replyTo: this.replyToEmail,
      subject: 'Verify Your Payment Method - PazarOne',
      html: this.getPaymentMethodVerificationCodeEmailTemplate(code),
      text: `PazarOne – Payment Method Verification

Your payment method verification code is: ${code}

This code expires in 10 minutes.

You received this email because you added a payment method on PazarOne.
If this wasn't you, ignore this message.
Support: ${this.replyToEmail}`,
      headers: this.getEmailHeaders(email),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Payment method verification code sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send payment method verification code to ${email}:`,
        error,
      );
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
          <div style="padding: 20px;">
            ${this.getLogoHtml()}
            <h1 style="color: #2c3e50; margin-top: 0; font-size: 24px;">Verify Your Email</h1>
            <p>Please use the following code to verify your email address:</p>
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="color: #2c3e50; font-size: 28px; letter-spacing: 6px; margin: 0; font-weight: 600;">${code}</div>
            </div>
            <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            ${this.getEmailFooter('you signed up on PazarOne')}
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
          <div style="padding: 20px;">
            ${this.getLogoHtml()}
            <h1 style="color: #2c3e50; margin-top: 0; font-size: 24px;">Verify Your Email</h1>
            <p>Please click the button below to verify your email address:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" style="background-color: #3498db; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: 500;">Verify Email</a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 12px; word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${link}</p>
            <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
            ${this.getEmailFooter('you signed up on PazarOne')}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Send order confirmation email to customer
   */
  async sendOrderConfirmation(
    email: string,
    orderNumber: string,
    totalAmount: number,
    items: Array<{ productName: string; quantity: number; price: number }>,
  ): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      replyTo: this.replyToEmail,
      subject: `Order Confirmation - ${orderNumber}`,
      html: this.getOrderConfirmationEmailTemplate(
        orderNumber,
        totalAmount,
        items,
      ),
      text: `PazarOne – Order Confirmation

Your order ${orderNumber} has been confirmed.

Order Details:
${items.map(item => `- ${item.productName} (Qty: ${item.quantity}) - ${item.price.toFixed(2)} MKD`).join('\n')}

Total: ${totalAmount.toFixed(2)} MKD

You will receive another email when your order ships.

You received this email because you made an order on PazarOne.
Support: ${this.replyToEmail}`,
      headers: this.getEmailHeaders(email),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Order confirmation email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send order confirmation email to ${email}:`,
        error,
      );
      // Don't throw - email failures shouldn't break order creation
    }
  }

  /**
   * Send shipping notification email to customer
   */
  async sendShippingNotification(
    email: string,
    orderNumber: string,
    status: string,
    trackingId?: string,
  ): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: `Order ${orderNumber} - ${status === 'in_transit' ? 'Shipped' : 'Delivered'}`,
      html: this.getShippingNotificationEmailTemplate(
        orderNumber,
        status,
        trackingId,
      ),
      text: `Your order ${orderNumber} status: ${status}${trackingId ? `. Tracking ID: ${trackingId}` : ''}`,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Shipping notification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send shipping notification email to ${email}:`,
        error,
      );
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, resetLink: string): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      replyTo: this.replyToEmail,
      subject: 'Reset Your Password - PazarOne',
      html: this.getPasswordResetEmailTemplate(resetLink),
      text: `PazarOne – Password Reset

We received a request to reset your password.

Click this link to reset your password:
${resetLink}

This link expires in 1 hour.

You received this email because a password reset was requested for your account.
If you didn't request this, ignore this message.
Support: ${this.replyToEmail}`,
      headers: this.getEmailHeaders(email),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send order cancellation/return email to customer
   */
  async sendOrderCancellationOrReturn(
    email: string,
    orderNumber: string,
    type: 'cancelled' | 'returned',
    explanation?: string,
  ): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: `Order ${orderNumber} - ${type === 'cancelled' ? 'Cancelled' : 'Returned'}`,
      html: this.getOrderCancellationEmailTemplate(
        orderNumber,
        type,
        explanation,
      ),
      text: `PazarOne – Order ${type === 'cancelled' ? 'Cancellation' : 'Return'}

Your order ${orderNumber} has been ${type}.
${explanation ? `Reason: ${explanation}` : ''}

If you have any questions, please contact our support team.

You received this email because you made an order on PazarOne.
Support: ${this.replyToEmail}`,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Order ${type} email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send order ${type} email to ${email}:`, error);
    }
  }

  /**
   * Send password change confirmation email
   */
  async sendPasswordChangeConfirmation(email: string): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      replyTo: this.replyToEmail,
      subject: 'Password Changed Successfully - PazarOne',
      html: this.getPasswordChangeConfirmationEmailTemplate(),
      text: `PazarOne – Password Changed

Your password has been changed successfully.

Date: ${new Date().toLocaleString()}

If you did not make this change, please contact our support team.
Support: ${this.replyToEmail}

You received this email because your password was changed on PazarOne.`,
      headers: this.getEmailHeaders(email),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Password change confirmation email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password change confirmation email to ${email}:`,
        error,
      );
      // Don't throw - email failures shouldn't break password change
    }
  }

  /**
   * Send seller notification email (new order, product approved/rejected)
   */
  async sendSellerNotification(
    email: string,
    type: 'new_order' | 'product_approved' | 'product_rejected',
    data: {
      orderNumber?: string;
      totalAmount?: number;
      productName?: string;
      rejectionMessage?: string;
    },
  ): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      replyTo: this.replyToEmail,
      subject:
        type === 'new_order'
          ? `New Order Received - ${data.orderNumber}`
          : type === 'product_approved'
            ? `Product Approved - ${data.productName}`
            : `Product Rejected - ${data.productName}`,
      html: this.getSellerNotificationEmailTemplate(type, data),
      text: this.getSellerNotificationText(type, data),
      headers: this.getEmailHeaders(email),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Seller notification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send seller notification email to ${email}:`, error);
    }
  }

  /**
   * Send weekly affiliate newsletter
   */
  async sendAffiliateWeeklyNewsletter(
    email: string,
    name: string,
    stats: {
      totalEarnings: number;
      availableBalance: number;
      totalClicks: number;
      totalOrders: number;
      referralCode: string;
      referralLink: string;
      thisWeekClicks?: number;
      thisWeekOrders?: number;
      thisWeekEarnings?: number;
    },
    productsOnSale: Array<{
      id: string;
      name: string;
      description: string;
      regularPrice: number | null;
      salePrice: number | null;
      affiliateCommission: number;
      imageUrl: string | null;
    }>,
    topProducts: Array<{
      id: string;
      name: string;
      description: string;
      regularPrice: number | null;
      salePrice: number | null;
      affiliateCommission: number;
      imageUrl: string | null;
    }>,
    highCommissionProducts: Array<{
      id: string;
      name: string;
      description: string;
      regularPrice: number | null;
      salePrice: number | null;
      affiliateCommission: number;
      imageUrl: string | null;
    }>,
    motivationalMessage: string,
  ): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      replyTo: this.replyToEmail,
      subject: 'Weekly Affiliate Update - Hot Products & Your Earnings',
      html: this.getAffiliateWeeklyNewsletterEmailTemplate(
        name,
        stats,
        productsOnSale,
        topProducts,
        highCommissionProducts,
        motivationalMessage,
      ),
      text: this.getAffiliateWeeklyNewsletterText(
        name,
        stats,
        productsOnSale,
        topProducts,
        highCommissionProducts,
        motivationalMessage,
      ),
      headers: this.getEmailHeaders(email),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Affiliate weekly newsletter sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send affiliate weekly newsletter to ${email}:`,
        error,
      );
      throw error; // Re-throw to allow caller to handle
    }
  }

  // Email Templates

  private getOrderConfirmationEmailTemplate(
    orderNumber: string,
    totalAmount: number,
    items: Array<{ productName: string; quantity: number; price: number }>,
  ): string {
    const itemsHtml = items
      .map(
        (item) =>
          `<tr><td>${item.productName}</td><td style="text-align: center;">${item.quantity}</td><td style="text-align: right;">${item.price.toFixed(2)} MKD</td></tr>`,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
            ${this.getLogoHtml()}
            <h1 style="color: #27ae60; margin-top: 0;">Order Confirmed!</h1>
            <p>Thank you for your order! We've received your order and will process it shortly.</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #2c3e50; margin-top: 0;">Order #${orderNumber}</h2>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background-color: #ecf0f1;">
                    <th style="padding: 10px; text-align: left;">Item</th>
                    <th style="padding: 10px; text-align: center;">Quantity</th>
                    <th style="padding: 10px; text-align: right;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr style="border-top: 2px solid #3498db;">
                    <td colspan="2" style="padding: 10px; font-weight: bold; text-align: right;">Total:</td>
                    <td style="padding: 10px; font-weight: bold; text-align: right;">${totalAmount.toFixed(2)} MKD</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p>You will receive another email when your order ships.</p>
            ${this.getEmailFooter('you made an order on PazarOne')}
          </div>
        </body>
      </html>
    `;
  }

  private getShippingNotificationEmailTemplate(
    orderNumber: string,
    status: string,
    trackingId?: string,
  ): string {
    const isDelivered = status === 'delivered';
    const title = isDelivered ? 'Order Delivered!' : 'Order Shipped!';
    const message = isDelivered
      ? 'Your order has been delivered. We hope you enjoy your purchase!'
      : 'Your order has been shipped and is on its way to you.';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
            ${this.getLogoHtml()}
            <h1 style="color: ${isDelivered ? '#27ae60' : '#3498db'}; margin-top: 0;">${title}</h1>
            <p>${message}</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Order Number:</strong> ${orderNumber}</p>
              ${trackingId ? `<p><strong>Tracking ID:</strong> ${trackingId}</p>` : ''}
            </div>
            ${isDelivered ? '<p>Thank you for shopping with PazarOne!</p>' : '<p>You can track your order using the tracking ID above.</p>'}
            ${this.getEmailFooter('you made an order on PazarOne')}
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetEmailTemplate(resetLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="padding: 20px;">
            ${this.getLogoHtml()}
            <h1 style="color: #2c3e50; margin-top: 0; font-size: 24px;">Reset Your Password</h1>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #3498db; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: 500;">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 12px; word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${resetLink}</p>
            <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request a password reset, please ignore this email.</p>
            ${this.getEmailFooter('a password reset was requested for your account')}
          </div>
        </body>
      </html>
    `;
  }

  private getOrderCancellationEmailTemplate(
    orderNumber: string,
    type: 'cancelled' | 'returned',
    explanation?: string,
  ): string {
    const title = type === 'cancelled' ? 'Order Cancelled' : 'Order Returned';
    const message =
      type === 'cancelled'
        ? 'Your order has been cancelled.'
        : 'Your order return request has been processed.';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
            ${this.getLogoHtml()}
            <h1 style="color: #e74c3c; margin-top: 0;">${title}</h1>
            <p>${message}</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Order Number:</strong> ${orderNumber}</p>
              ${explanation ? `<p><strong>Reason:</strong> ${explanation}</p>` : ''}
            </div>
            <p>If you have any questions, please contact our support team.</p>
            ${this.getEmailFooter('you made an order on PazarOne')}
          </div>
        </body>
      </html>
    `;
  }

  private getSellerNotificationEmailTemplate(
    type: 'new_order' | 'product_approved' | 'product_rejected',
    data: {
      orderNumber?: string;
      totalAmount?: number;
      productName?: string;
      rejectionMessage?: string;
    },
  ): string {
    if (type === 'new_order') {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
              ${this.getLogoHtml()}
              <h1 style="color: #27ae60; margin-top: 0;">New Order Received!</h1>
              <p>You have received a new order on PazarOne.</p>
              <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Order Number:</strong> ${data.orderNumber}</p>
                <p><strong>Total Amount:</strong> ${data.totalAmount?.toFixed(2)} MKD</p>
              </div>
              <p>Please log in to your seller dashboard to process this order.</p>
              <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
              <p style="color: #95a5a6; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} PazarOne. All rights reserved.</p>
            </div>
          </body>
        </html>
      `;
    } else if (type === 'product_approved') {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
              ${this.getLogoHtml()}
              <h1 style="color: #27ae60; margin-top: 0;">Product Approved!</h1>
              <p>Your product has been approved and is now live on PazarOne.</p>
              <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Product:</strong> ${data.productName}</p>
              </div>
              <p>Your product is now visible to customers and ready for sale.</p>
              ${this.getEmailFooter('you are a seller on PazarOne')}
            </div>
          </body>
        </html>
      `;
    } else {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
              ${this.getLogoHtml()}
              <h1 style="color: #e74c3c; margin-top: 0;">Product Rejected</h1>
              <p>Your product has been rejected and requires review.</p>
              <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Product:</strong> ${data.productName}</p>
                ${data.rejectionMessage ? `<p><strong>Reason:</strong> ${data.rejectionMessage}</p>` : ''}
              </div>
              <p>Please review the feedback and update your product accordingly.</p>
              ${this.getEmailFooter('you are a seller on PazarOne')}
            </div>
          </body>
        </html>
      `;
    }
  }

  private getSellerNotificationText(
    type: 'new_order' | 'product_approved' | 'product_rejected',
    data: {
      orderNumber?: string;
      totalAmount?: number;
      productName?: string;
      rejectionMessage?: string;
    },
  ): string {
    if (type === 'new_order') {
      return `PazarOne – New Order

You have received a new order on PazarOne.

Order Number: ${data.orderNumber}
Total Amount: ${data.totalAmount?.toFixed(2)} MKD

Please log in to your seller dashboard to process this order.

You received this email because you are a seller on PazarOne.
Support: ${this.replyToEmail}`;
    } else if (type === 'product_approved') {
      return `PazarOne – Product Approved

Your product "${data.productName}" has been approved and is now live on PazarOne.

Your product is now visible to customers and ready for sale.

You received this email because you are a seller on PazarOne.
Support: ${this.replyToEmail}`;
    } else {
      return `PazarOne – Product Rejected

Your product "${data.productName}" has been rejected and requires review.
${data.rejectionMessage ? `Reason: ${data.rejectionMessage}` : ''}

Please review the feedback and update your product accordingly.

You received this email because you are a seller on PazarOne.
Support: ${this.replyToEmail}`;
    }
  }

  private getPasswordChangeConfirmationEmailTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
            ${this.getLogoHtml()}
            <h1 style="color: #27ae60; margin-top: 0;">Password Changed Successfully</h1>
            <p>Your password has been changed successfully.</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
              <p style="margin: 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="color: #666; font-size: 14px;">If you did not make this change, please contact our support team.</p>
            <p style="color: #666; font-size: 14px;">For security reasons, if you did not change your password, we recommend:</p>
            <ul style="color: #666; font-size: 14px;">
              <li>Changing your password again</li>
              <li>Reviewing your account activity</li>
              <li>Contacting support if you notice any suspicious activity</li>
            </ul>
            ${this.getEmailFooter('your password was changed on PazarOne')}
          </div>
        </body>
      </html>
    `;
  }

  private getPaymentMethodVerificationCodeEmailTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="padding: 20px;">
            ${this.getLogoHtml()}
            <h1 style="color: #2c3e50; margin-top: 0; font-size: 24px;">Verify Your Payment Method</h1>
            <p>Please use the following code to verify your payment method:</p>
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="color: #2c3e50; font-size: 28px; letter-spacing: 6px; margin: 0; font-weight: 600;">${code}</div>
            </div>
            <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            ${this.getEmailFooter('you added a payment method on PazarOne')}
          </div>
        </body>
      </html>
    `;
  }

  private getAffiliateWeeklyNewsletterEmailTemplate(
    name: string,
    stats: {
      totalEarnings: number;
      availableBalance: number;
      totalClicks: number;
      totalOrders: number;
      referralCode: string;
      referralLink: string;
      thisWeekClicks?: number;
      thisWeekOrders?: number;
      thisWeekEarnings?: number;
    },
    productsOnSale: Array<{
      id: string;
      name: string;
      description: string;
      regularPrice: number | null;
      salePrice: number | null;
      affiliateCommission: number;
      imageUrl: string | null;
    }>,
    topProducts: Array<{
      id: string;
      name: string;
      description: string;
      regularPrice: number | null;
      salePrice: number | null;
      affiliateCommission: number;
      imageUrl: string | null;
    }>,
    highCommissionProducts: Array<{
      id: string;
      name: string;
      description: string;
      regularPrice: number | null;
      salePrice: number | null;
      affiliateCommission: number;
      imageUrl: string | null;
    }>,
    motivationalMessage: string,
  ): string {
    const formatPrice = (price: number | null): string => {
      if (!price) return 'N/A';
      return `${price.toFixed(2)} den`;
    };

    const formatProductCard = (
      product: {
        id: string;
        name: string;
        description: string;
        regularPrice: number | null;
        salePrice: number | null;
        affiliateCommission: number;
        imageUrl: string | null;
      },
      referralCode: string,
    ): string => {
      const productUrl = `${this.frontendUrl}/products/${product.id}?ref=${referralCode}`;
      const effectivePrice = product.salePrice || product.regularPrice;
      const discount =
        product.salePrice && product.regularPrice
          ? Math.round(
              ((product.regularPrice - product.salePrice) /
                product.regularPrice) *
                100,
            )
          : 0;

      return `
        <div style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
          <div style="display: flex; gap: 15px;">
            ${product.imageUrl
              ? `<div style="flex-shrink: 0;">
                  <img src="${product.imageUrl}" alt="${product.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;" />
                </div>`
              : ''}
            <div style="flex: 1;">
              <h3 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 18px;">
                <a href="${productUrl}" style="color: #3498db; text-decoration: none;">${product.name}</a>
              </h3>
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px; line-height: 1.4;">
                ${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}
              </p>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <div>
                  ${product.salePrice && product.regularPrice
                    ? `<div style="color: #e74c3c; font-size: 20px; font-weight: bold;">
                        ${formatPrice(product.salePrice)}
                        <span style="color: #999; font-size: 14px; font-weight: normal; text-decoration: line-through; margin-left: 8px;">
                          ${formatPrice(product.regularPrice)}
                        </span>
                        <span style="background-color: #e74c3c; color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin-left: 8px;">
                          -${discount}%
                        </span>
                      </div>`
                    : `<div style="color: #2c3e50; font-size: 20px; font-weight: bold;">${formatPrice(effectivePrice)}</div>`}
                  <div style="color: #27ae60; font-size: 14px; margin-top: 4px;">
                    Commission: ${product.affiliateCommission.toFixed(1)}%
                  </div>
                </div>
                <a href="${productUrl}" style="background-color: #3498db; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500;">
                  View Product
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    };

    const productsOnSaleHtml =
      productsOnSale.length > 0
        ? productsOnSale
            .map((product) => formatProductCard(product, stats.referralCode))
            .join('')
        : '<p style="color: #666;">No products on sale this week.</p>';

    const topProductsHtml =
      topProducts.length > 0
        ? topProducts
            .map((product) => formatProductCard(product, stats.referralCode))
            .join('')
        : '<p style="color: #666;">No top products available.</p>';

    const highCommissionProductsHtml =
      highCommissionProducts.length > 0
        ? highCommissionProducts
            .map((product) => formatProductCard(product, stats.referralCode))
            .join('')
        : '<p style="color: #666;">No high commission products available.</p>';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
            ${this.getLogoHtml()}
            <h1 style="color: #2c3e50; margin-top: 0; font-size: 28px;">Hello ${name}!</h1>
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
              ${motivationalMessage}
            </p>

            <!-- Performance Stats Section -->
            <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
              <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Your Performance</h2>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px;">
                <div>
                  <div style="color: #999; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Total Earnings</div>
                  <div style="color: #27ae60; font-size: 24px; font-weight: bold;">${stats.totalEarnings.toFixed(2)} den</div>
                </div>
                <div>
                  <div style="color: #999; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Available Balance</div>
                  <div style="color: #3498db; font-size: 24px; font-weight: bold;">${stats.availableBalance.toFixed(2)} den</div>
                </div>
                <div>
                  <div style="color: #999; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Total Clicks</div>
                  <div style="color: #2c3e50; font-size: 24px; font-weight: bold;">${stats.totalClicks}</div>
                </div>
                <div>
                  <div style="color: #999; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Total Orders</div>
                  <div style="color: #2c3e50; font-size: 24px; font-weight: bold;">${stats.totalOrders}</div>
                </div>
              </div>
              ${stats.thisWeekClicks !== undefined || stats.thisWeekOrders !== undefined || stats.thisWeekEarnings !== undefined
                ? `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <div style="color: #999; font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">This Week</div>
                    <div style="display: flex; gap: 20px;">
                      ${stats.thisWeekClicks !== undefined ? `<span style="color: #666;">Clicks: <strong>${stats.thisWeekClicks}</strong></span>` : ''}
                      ${stats.thisWeekOrders !== undefined ? `<span style="color: #666;">Orders: <strong>${stats.thisWeekOrders}</strong></span>` : ''}
                      ${stats.thisWeekEarnings !== undefined ? `<span style="color: #27ae60;">Earnings: <strong>${stats.thisWeekEarnings.toFixed(2)} den</strong></span>` : ''}
                    </div>
                  </div>`
                : ''}
            </div>

            <!-- Products on Sale Section -->
            ${productsOnSale.length > 0
              ? `<div style="margin: 30px 0;">
                  <h2 style="color: #e74c3c; margin-top: 0; font-size: 22px;">🔥 Products on Sale</h2>
                  ${productsOnSaleHtml}
                </div>`
              : ''}

            <!-- Top Products Section -->
            ${topProducts.length > 0
              ? `<div style="margin: 30px 0;">
                  <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">⭐ Top-Selling Products</h2>
                  ${topProductsHtml}
                </div>`
              : ''}

            <!-- High Commission Products Section -->
            ${highCommissionProducts.length > 0
              ? `<div style="margin: 30px 0;">
                  <h2 style="color: #27ae60; margin-top: 0; font-size: 22px;">💰 High Commission Products</h2>
                  ${highCommissionProductsHtml}
                </div>`
              : ''}

            <!-- Call to Action -->
            <div style="text-align: center; margin: 30px 0; padding: 25px; background-color: #3498db; border-radius: 8px;">
              <h3 style="color: #fff; margin-top: 0; font-size: 20px;">Your Referral Link</h3>
              <p style="color: #fff; margin: 15px 0; font-size: 14px; word-break: break-all; background-color: rgba(255,255,255,0.2); padding: 10px; border-radius: 4px;">
                ${stats.referralLink}
              </p>
              <p style="color: #fff; margin: 10px 0; font-size: 14px;">Referral Code: <strong>${stats.referralCode}</strong></p>
              <a href="${stats.referralLink}" style="display: inline-block; background-color: #fff; color: #3498db; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 15px;">
                Go to Dashboard
              </a>
            </div>

            ${this.getEmailFooter('you are an affiliate on PazarOne')}
          </div>
        </body>
      </html>
    `;
  }

  private getAffiliateWeeklyNewsletterText(
    name: string,
    stats: {
      totalEarnings: number;
      availableBalance: number;
      totalClicks: number;
      totalOrders: number;
      referralCode: string;
      referralLink: string;
      thisWeekClicks?: number;
      thisWeekOrders?: number;
      thisWeekEarnings?: number;
    },
    productsOnSale: Array<{
      id: string;
      name: string;
      description: string;
      regularPrice: number | null;
      salePrice: number | null;
      affiliateCommission: number;
      imageUrl: string | null;
    }>,
    topProducts: Array<{
      id: string;
      name: string;
      description: string;
      regularPrice: number | null;
      salePrice: number | null;
      affiliateCommission: number;
      imageUrl: string | null;
    }>,
    highCommissionProducts: Array<{
      id: string;
      name: string;
      description: string;
      regularPrice: number | null;
      salePrice: number | null;
      affiliateCommission: number;
      imageUrl: string | null;
    }>,
    motivationalMessage: string,
  ): string {
    const formatPrice = (price: number | null): string => {
      if (!price) return 'N/A';
      return `${price.toFixed(2)} den`;
    };

    const formatProductList = (
      products: Array<{
        name: string;
        regularPrice: number | null;
        salePrice: number | null;
        affiliateCommission: number;
      }>,
    ): string => {
      if (products.length === 0) return 'None';
      return products
        .map(
          (p) =>
            `- ${p.name} (${p.salePrice ? formatPrice(p.salePrice) : formatPrice(p.regularPrice)}, Commission: ${p.affiliateCommission.toFixed(1)}%)`,
        )
        .join('\n');
    };

    return `PazarOne – Weekly Affiliate Update

Hello ${name}!

${motivationalMessage}

YOUR PERFORMANCE
Total Earnings: ${stats.totalEarnings.toFixed(2)} den
Available Balance: ${stats.availableBalance.toFixed(2)} den
Total Clicks: ${stats.totalClicks}
Total Orders: ${stats.totalOrders}
${stats.thisWeekClicks !== undefined || stats.thisWeekOrders !== undefined || stats.thisWeekEarnings !== undefined
        ? `\nThis Week:
${stats.thisWeekClicks !== undefined ? `Clicks: ${stats.thisWeekClicks}\n` : ''}${stats.thisWeekOrders !== undefined ? `Orders: ${stats.thisWeekOrders}\n` : ''}${stats.thisWeekEarnings !== undefined ? `Earnings: ${stats.thisWeekEarnings.toFixed(2)} den\n` : ''}`
        : ''}

PRODUCTS ON SALE
${formatProductList(productsOnSale)}

TOP-SELLING PRODUCTS
${formatProductList(topProducts)}

HIGH COMMISSION PRODUCTS
${formatProductList(highCommissionProducts)}

YOUR REFERRAL LINK
${stats.referralLink}
Referral Code: ${stats.referralCode}

Visit your dashboard: ${this.frontendUrl}/affiliate/dashboard

You received this email because you are an affiliate on PazarOne.
Support: ${this.replyToEmail}`;
  }
}
