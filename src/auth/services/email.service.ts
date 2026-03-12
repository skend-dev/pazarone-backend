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
  /** From/reply-to for marketing & announcements (broadcast emails) */
  private readonly marketingFromEmail: string;
  private readonly marketingFromName: string;
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
    this.marketingFromEmail =
      this.configService.get<string>('SENDGRID_MARKETING_FROM_EMAIL') ||
      'hello@pazarone.co';
    this.marketingFromName =
      this.configService.get<string>('SENDGRID_MARKETING_FROM_NAME') ||
      'PazarOne Marketing';
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
      <div style="text-align: center; margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid #e8ecef;">
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
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e8ecef; color: #6b7280; font-size: 13px; line-height: 1.7;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #1a1d21;">PazarOne</p>
        <p style="margin: 0 0 6px 0;">Official platform: <a href="${this.frontendUrl}" style="color: #3b82f6; text-decoration: none;">${this.frontendUrl}</a></p>
        <p style="margin: 0 0 6px 0;">Support: <a href="mailto:${this.replyToEmail}" style="color: #3b82f6; text-decoration: none;">${this.replyToEmail}</a></p>
        <p style="margin: 12px 0 0 0; color: #9ca3af; font-size: 12px;">You received this email because ${reason}.</p>
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
   * Send broadcast announcement email (admin broadcast to affiliates, sellers, customers)
   * Optional product cards with CTA links (productUrl already includes ?ref= for affiliates when applicable)
   */
  async sendBroadcastAnnouncement(
    email: string,
    name: string,
    title: string,
    message: string,
    products?: Array<{
      id: string;
      name: string;
      price: number | null;
      salePrice: number | null;
      imageUrl: string | null;
      productUrl: string;
    }>,
  ): Promise<void> {
    const msg = {
      to: email,
      from: {
        email: this.marketingFromEmail,
        name: this.marketingFromName,
      },
      replyTo: this.marketingFromEmail,
      subject: title,
      html: this.getBroadcastAnnouncementEmailTemplate(
        name,
        title,
        message,
        products || [],
      ),
      text: this.getBroadcastAnnouncementText(name, title, message, products || []),
      headers: this.getEmailHeaders(email),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Broadcast announcement email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send broadcast announcement email to ${email}:`,
        error,
      );
      throw error;
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

  private getBroadcastAnnouncementEmailTemplate(
    name: string,
    title: string,
    message: string,
    products: Array<{
      id: string;
      name: string;
      price: number | null;
      salePrice: number | null;
      imageUrl: string | null;
      productUrl: string;
    }>,
  ): string {
    const formatPrice = (price: number | null): string => {
      if (price === null || price === undefined) return 'N/A';
      return `${Number(price).toFixed(2)} den`;
    };

    const productCardsHtml =
      products.length > 0
        ? products
            .map((product) => {
              const effectivePrice = product.salePrice ?? product.price;
              const discount =
                product.salePrice != null &&
                product.price != null &&
                product.price > 0
                  ? Math.round(
                      ((product.price - product.salePrice) / product.price) * 100,
                    )
                  : 0;
              const hasDiscount = discount > 0;
              return `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="product-card" style="margin-bottom: 20px; border-collapse: separate; border-spacing: 0; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border: 1px solid #e8ecef;">
          <tr>
            ${product.imageUrl ? `
            <td class="product-img-td" style="width: 140px; vertical-align: top; padding: 0;">
              <a href="${product.productUrl}" style="display: block;">
                <img src="${product.imageUrl}" alt="${product.name}" class="product-img" width="140" height="140" style="display: block; width: 140px; height: 140px; object-fit: cover;" />
              </a>
            </td>` : ''}
            <td class="product-content-td" style="padding: 20px; vertical-align: top;">
              <a href="${product.productUrl}" style="text-decoration: none; color: #1a1d21;">
                <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1a1d21; line-height: 1.4;">${product.name}</h3>
              </a>
              <table role="presentation" cellpadding="0" cellspacing="0" class="price-action-table" style="margin-top: 16px; width: 100%;">
                <tr>
                  <td class="price-td" style="vertical-align: middle;">
                    ${hasDiscount ? `
                    <span style="font-size: 22px; font-weight: 700; color: #dc2626;">${formatPrice(product.salePrice)}</span>
                    <span style="font-size: 14px; color: #9ca3af; text-decoration: line-through; margin-left: 8px;">${formatPrice(product.price)}</span>
                    <span class="discount-badge" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-left: 10px; vertical-align: middle;">-${discount}%</span>
                    ` : `
                    <span style="font-size: 22px; font-weight: 700; color: #1a1d21;">${formatPrice(effectivePrice)}</span>
                    `}
                  </td>
                  <td class="action-td" style="padding-left: 16px; vertical-align: middle; text-align: right;">
                    <a href="${product.productUrl}" class="action-btn" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; white-space: nowrap;">View Product →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`;
            })
            .join('')
        : '';

    const productsSection =
      products.length > 0
        ? `
      <div style="margin: 32px 0;">
        <h2 style="color: #1a1d21; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Featured Products</h2>
        ${productCardsHtml}
      </div>
    `
        : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            @media screen and (max-width: 600px) {
              .email-wrapper { padding: 12px !important; }
              .email-card { padding: 16px !important; }
              .product-card { display: block !important; width: 100% !important; }
              .product-img-td { display: block !important; width: 100% !important; padding: 0 !important; border-bottom: 1px solid #f0f0f0 !important; }
              .product-img { width: 100% !important; height: auto !important; max-width: 100% !important; object-fit: contain !important; margin: 0 auto !important; border-bottom-left-radius: 0 !important; border-top-right-radius: 12px !important; }
              .product-content-td { display: block !important; width: 100% !important; padding: 16px !important; box-sizing: border-box !important; }
              .price-action-table, .price-action-table tbody, .price-action-table tr { display: block !important; width: 100% !important; }
              .price-td { display: block !important; width: 100% !important; text-align: left !important; }
              .action-td { display: block !important; width: 100% !important; padding-left: 0 !important; padding-top: 16px !important; text-align: center !important; }
              .action-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; padding: 14px 20px !important; }
              .discount-badge { margin-top: 8px !important; margin-left: 0 !important; display: inline-block !important; }
            }
          </style>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1d21; margin: 0; padding: 0; background-color: #f4f6f8;">
          <div class="email-wrapper" style="max-width: 600px; margin: 0 auto; padding: 24px;">
            <div class="email-card" style="background-color: #ffffff; padding: 32px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
              ${this.getLogoHtml()}
              <h1 style="color: #1a1d21; margin: 0 0 16px 0; font-size: 24px; font-weight: 700;">${title}</h1>
              <p style="font-size: 16px; color: #4a5568; margin: 0 0 12px 0;">Hello ${name},</p>
              <p style="font-size: 16px; color: #1a1d21; white-space: pre-wrap; margin: 0;">${message}</p>
              ${productsSection}
              ${this.getEmailFooter('you are registered on PazarOne')}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getBroadcastAnnouncementText(
    name: string,
    title: string,
    message: string,
    products: Array<{
      id: string;
      name: string;
      productUrl: string;
    }>,
  ): string {
    let text = `PazarOne – ${title}\n\nHello ${name},\n\n${message}\n\n`;
    if (products.length > 0) {
      text += 'Featured products:\n';
      products.forEach((p) => {
        text += `- ${p.name}: ${p.productUrl}\n`;
      });
    }
    text += `\nYou received this email because you are registered on PazarOne.`;
    return text;
  }

  private getOrderConfirmationEmailTemplate(
    orderNumber: string,
    totalAmount: number,
    items: Array<{ productName: string; quantity: number; price: number }>,
  ): string {
    const itemsHtml = items
      .map(
        (item, i) => {
          const rowBg = i % 2 === 0 ? '#ffffff' : '#fafafa';
          return `<tr style="background-color: ${rowBg};">
            <td style="padding: 14px 16px; border-bottom: 1px solid #e8ecef; color: #1a1d21; font-size: 15px;">${item.productName}</td>
            <td style="padding: 14px 16px; border-bottom: 1px solid #e8ecef; text-align: center; color: #4a5568; font-size: 14px;">${item.quantity}</td>
            <td style="padding: 14px 16px; border-bottom: 1px solid #e8ecef; text-align: right; color: #1a1d21; font-weight: 500;">${item.price.toFixed(2)} MKD</td>
          </tr>`;
        },
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation - ${orderNumber}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1d21; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f4f6f8;">
          <div style="background-color: #ffffff; padding: 32px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            ${this.getLogoHtml()}
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px 24px; border-radius: 10px; margin-bottom: 24px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Order Confirmed!</h1>
              <p style="color: rgba(255,255,255,0.95); margin: 8px 0 0 0; font-size: 15px;">Thank you for your order. We've received it and will process it shortly.</p>
            </div>
            <p style="color: #4a5568; font-size: 15px; margin: 0 0 24px 0;">Order details:</p>
            <div style="background-color: #f8fafc; padding: 24px; border-radius: 10px; border: 1px solid #e8ecef;">
              <h2 style="color: #1a1d21; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">Order #${orderNumber}</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #1a1d21;">
                    <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Product</th>
                    <th style="padding: 12px 16px; text-align: center; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                    <th style="padding: 12px 16px; text-align: right; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #e8f5e9;">
                    <td colspan="2" style="padding: 16px; font-weight: 700; text-align: right; color: #1a1d21; font-size: 16px;">Total:</td>
                    <td style="padding: 16px; font-weight: 700; text-align: right; color: #059669; font-size: 18px;">${totalAmount.toFixed(2)} MKD</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0;">You will receive another email when your order ships.</p>
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
          <div class="flex-col-mobile" style="display: flex; gap: 15px;">
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
              <div class="price-btn-row" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <div>
                  ${product.salePrice && product.regularPrice
                    ? `<div style="color: #e74c3c; font-size: 20px; font-weight: bold;">
                        ${formatPrice(product.salePrice)}
                        <span style="color: #999; font-size: 14px; font-weight: normal; text-decoration: line-through; margin-left: 8px;">
                          ${formatPrice(product.regularPrice)}
                        </span>
                        <span style="display: inline-block; background-color: #e74c3c; color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin-left: 8px; margin-top: 4px;">
                          -${discount}%
                        </span>
                      </div>`
                    : `<div style="color: #2c3e50; font-size: 20px; font-weight: bold;">${formatPrice(effectivePrice)}</div>`}
                  <div style="color: #27ae60; font-size: 14px; margin-top: 4px;">
                    Commission: ${product.affiliateCommission.toFixed(1)}%
                  </div>
                </div>
                <a href="${productUrl}" style="background-color: #3498db; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500; display: inline-block;">
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
          <style>
            @media screen and (max-width: 600px) {
              .email-wrapper { padding: 10px !important; }
              .email-card { padding: 15px !important; }
              .flex-col-mobile { flex-direction: column !important; }
              .flex-col-mobile > div { width: 100% !important; display: block !important; padding: 0 !important; }
              .flex-col-mobile img { width: 100% !important; height: auto !important; max-height: 250px !important; object-fit: contain !important; }
              .stats-grid { grid-template-columns: 1fr !important; }
              .price-btn-row { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
              .price-btn-row > a { text-align: center !important; }
            }
          </style>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f0f2f5;">
          <div class="email-wrapper" style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div class="email-card" style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
              ${this.getLogoHtml()}
              <h1 style="color: #2c3e50; margin-top: 0; font-size: 28px;">Hello ${name}!</h1>
              <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
                ${motivationalMessage}
              </p>

              <!-- Performance Stats Section -->
              <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
                <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Your Performance</h2>
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px;">
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
