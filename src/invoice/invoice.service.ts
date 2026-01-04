import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User, UserType } from '../users/entities/user.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { AffiliateCommission } from '../affiliate/entities/affiliate-commission.entity';
import { SellerSettingsService } from '../seller/seller-settings.service';
import { Product, ProductStatus } from '../products/entities/product.entity';
import { ConfigService } from '@nestjs/config';

// Use require for SendGrid to avoid TypeScript module resolution issues
const sgMail = require('@sendgrid/mail');

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(SellerSettings)
    private sellerSettingsRepository: Repository<SellerSettings>,
    @InjectRepository(AffiliateCommission)
    private affiliateCommissionRepository: Repository<AffiliateCommission>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private sellerSettingsService: SellerSettingsService,
    private configService: ConfigService,
  ) {
    // Initialize SendGrid if API key is available
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    } else {
      this.logger.warn(
        'SENDGRID_API_KEY not configured. Invoice emails will not be sent.',
      );
    }
  }

  /**
   * Generate invoice number in format: INV-YYYY-WW-SELLERID or INV-YYYY-WW-SELLERID-N
   * Example: INV-2024-03-abc123def or INV-2024-03-abc123def-1
   * If an invoice with the base number exists, adds a sequence number
   */
  private async generateInvoiceNumber(
    year: number,
    weekNumber: number,
    sellerId: string,
  ): Promise<string> {
    // Get short seller ID (first 8 chars)
    const shortSellerId = sellerId.substring(0, 8);
    const baseInvoiceNumber = `INV-${year}-${weekNumber.toString().padStart(2, '0')}-${shortSellerId}`;

    // Check if invoice with this number already exists
    const existingInvoice = await this.invoiceRepository.findOne({
      where: { invoiceNumber: baseInvoiceNumber },
    });

    if (!existingInvoice) {
      return baseInvoiceNumber;
    }

    // If exists, add sequence number
    let sequence = 1;
    let invoiceNumber = `${baseInvoiceNumber}-${sequence}`;

    while (
      await this.invoiceRepository.findOne({
        where: { invoiceNumber },
      })
    ) {
      sequence++;
      invoiceNumber = `${baseInvoiceNumber}-${sequence}`;
    }

    return invoiceNumber;
  }

  /**
   * Get week number (ISO week)
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      )
    );
  }

  /**
   * Get Monday of the week for a given date
   */
  private getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  /**
   * Get Sunday of the week for a given date
   */
  private getSundayOfWeek(date: Date): Date {
    const monday = this.getMondayOfWeek(date);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return sunday;
  }

  /**
   * Calculate payment deadline (Friday, 3-5 days after invoice generation)
   * Default is 5 days (Monday + 4 days = Friday)
   */
  private calculateDueDate(invoiceDate: Date, days: number = 5): Date {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + days);
    // Ensure it's Friday
    while (dueDate.getDay() !== 5) {
      dueDate.setDate(dueDate.getDate() + 1);
    }
    return dueDate;
  }

  /**
   * Generate weekly invoices for all sellers
   * Called every Monday at 00:00
   */
  async generateWeeklyInvoices(): Promise<void> {
    this.logger.log('Starting weekly invoice generation...');

    const now = new Date();
    const invoiceDate = new Date(now);
    invoiceDate.setHours(0, 0, 0, 0); // Monday 00:00

    // Get previous week's Monday and Sunday
    const weekStart = this.getMondayOfWeek(
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    );
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = this.getSundayOfWeek(weekStart);
    weekEnd.setHours(23, 59, 59, 999);

    this.logger.log(
      `Generating invoices for week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`,
    );

    // Get all sellers
    const sellers = await this.usersRepository.find({
      where: { userType: UserType.SELLER },
    });

    let invoicesGenerated = 0;
    let invoicesSkipped = 0;

    for (const seller of sellers) {
      try {
        // Check if invoice already exists for this week
        const existingInvoice = await this.invoiceRepository.findOne({
          where: {
            sellerId: seller.id,
            weekStartDate: weekStart,
          },
        });

        if (existingInvoice) {
          this.logger.warn(
            `Invoice already exists for seller ${seller.id} for week ${weekStart.toISOString()}`,
          );
          invoicesSkipped++;
          continue;
        }

        // Get all delivered COD orders for this seller in the previous week
        const orders = await this.ordersRepository
          .createQueryBuilder('order')
          .leftJoinAndSelect('order.items', 'items')
          .leftJoinAndSelect('items.product', 'product')
          .where('order.sellerId = :sellerId', { sellerId: seller.id })
          .andWhere(
            '(order.paymentMethod = :paymentMethod OR order.paymentMethod IS NULL)',
            {
              paymentMethod: 'cod',
            },
          )
          .andWhere('order.status = :status', { status: OrderStatus.DELIVERED })
          .andWhere('order.sellerPaid = :sellerPaid', { sellerPaid: false })
          .andWhere('order.updatedAt BETWEEN :weekStart AND :weekEnd', {
            weekStart,
            weekEnd,
          })
          .getMany();

        if (orders.length === 0) {
          this.logger.log(`No COD orders found for seller ${seller.id}`);
          invoicesSkipped++;
          continue;
        }

        // Generate invoice
        const invoice = await this.generateInvoiceForSeller(
          seller.id,
          orders,
          weekStart,
          weekEnd,
          invoiceDate,
        );

        this.logger.log(
          `Generated invoice ${invoice.invoiceNumber} for seller ${seller.id} with ${orders.length} orders`,
        );
        invoicesGenerated++;
      } catch (error) {
        this.logger.error(
          `Error generating invoice for seller ${seller.id}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Invoice generation completed. Generated: ${invoicesGenerated}, Skipped: ${invoicesSkipped}`,
    );
  }

  /**
   * Generate invoice for a specific seller
   */
  async generateInvoiceForSeller(
    sellerId: string,
    orders: Order[],
    weekStart: Date,
    weekEnd: Date,
    invoiceDate: Date,
  ): Promise<Invoice> {
    // Get seller settings for platform fee
    const platformFeePercent =
      await this.sellerSettingsService.getPlatformFeePercent(sellerId);

    const year = invoiceDate.getFullYear();
    const weekNumber = this.getWeekNumber(weekStart);
    const invoiceNumber = await this.generateInvoiceNumber(
      year,
      weekNumber,
      sellerId,
    );

    const dueDate = this.calculateDueDate(invoiceDate);

    // Calculate totals and prepare invoice items data
    let totalAmountMKD = 0;
    let totalAmountEUR = 0;
    const invoiceItemsData: Array<{
      orderId: string;
      orderNumber: string;
      deliveryDate: Date;
      productPrice: number;
      productPriceMKD: number | null;
      productPriceEUR: number | null;
      platformFeePercent: number;
      platformFee: number;
      platformFeeMKD: number | null;
      platformFeeEUR: number | null;
      affiliateFeePercent: number | null;
      affiliateFee: number;
      affiliateFeeMKD: number | null;
      affiliateFeeEUR: number | null;
      totalOwed: number;
      totalOwedMKD: number | null;
      totalOwedEUR: number | null;
    }> = [];

    for (const order of orders) {
      const orderTotalBase = order.totalAmountBase
        ? parseFloat(order.totalAmountBase.toString())
        : parseFloat(order.totalAmount.toString());
      const sellerCurrency = order.sellerBaseCurrency || 'MKD';

      // Calculate platform fee
      const platformFee = (orderTotalBase * platformFeePercent) / 100;

      // Get affiliate commissions for this order
      const affiliateCommissions =
        await this.affiliateCommissionRepository.find({
          where: { orderId: order.id },
        });

      let affiliateFee = 0;
      affiliateCommissions.forEach((commission) => {
        affiliateFee += parseFloat(commission.commissionAmount.toString());
      });

      const totalOwed = platformFee + affiliateFee;

      // Calculate affiliate fee percentage (average across items)
      let affiliateFeePercent: number | null = null;
      if (affiliateFee > 0 && order.items && order.items.length > 0) {
        // Calculate average affiliate commission percentage from order items
        let totalItemAmount = 0;
        let totalCommission = 0;
        for (const item of order.items) {
          const itemTotal =
            parseFloat(item.basePrice?.toString() || item.price.toString()) *
            item.quantity;
          totalItemAmount += itemTotal;
          if (item.product) {
            totalCommission +=
              (itemTotal * item.product.affiliateCommission) / 100;
          }
        }
        if (totalItemAmount > 0) {
          affiliateFeePercent = (totalCommission / totalItemAmount) * 100;
        }
      }

      // Get delivery date (use updatedAt when status changed to DELIVERED)
      const deliveryDate = order.updatedAt || order.createdAt;

      invoiceItemsData.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveryDate,
        productPrice: orderTotalBase,
        productPriceMKD: sellerCurrency === 'MKD' ? orderTotalBase : null,
        productPriceEUR: sellerCurrency === 'EUR' ? orderTotalBase : null,
        platformFeePercent,
        platformFee,
        platformFeeMKD: sellerCurrency === 'MKD' ? platformFee : null,
        platformFeeEUR: sellerCurrency === 'EUR' ? platformFee : null,
        affiliateFeePercent,
        affiliateFee,
        affiliateFeeMKD: sellerCurrency === 'MKD' ? affiliateFee : null,
        affiliateFeeEUR: sellerCurrency === 'EUR' ? affiliateFee : null,
        totalOwed,
        totalOwedMKD: sellerCurrency === 'MKD' ? totalOwed : null,
        totalOwedEUR: sellerCurrency === 'EUR' ? totalOwed : null,
      });

      // Add to totals
      if (sellerCurrency === 'MKD') {
        totalAmountMKD += totalOwed;
      } else if (sellerCurrency === 'EUR') {
        totalAmountEUR += totalOwed;
      }
    }

    const totalAmount = totalAmountMKD + totalAmountEUR;

    // Create invoice first
    const invoice = this.invoiceRepository.create({
      invoiceNumber,
      sellerId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      dueDate,
      status: InvoiceStatus.PENDING,
      totalAmount,
      totalAmountMKD,
      totalAmountEUR,
      orderCount: orders.length,
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Create invoice items with invoice ID
    const invoiceItems = invoiceItemsData.map((data) =>
      this.invoiceItemRepository.create({
        ...data,
        invoiceId: savedInvoice.id,
      }),
    );

    await this.invoiceItemRepository.save(invoiceItems);

    // Reload invoice with items
    const finalInvoice = (await this.invoiceRepository.findOne({
      where: { id: savedInvoice.id },
      relations: ['items'],
    })) as Invoice;

    // Send email notification to seller
    try {
      const seller = await this.usersRepository.findOne({
        where: { id: sellerId },
      });
      if (seller?.email) {
        await this.sendInvoiceEmail(seller.email, finalInvoice);
      }
    } catch (error) {
      // Log error but don't fail invoice generation
      this.logger.error(
        `Failed to send invoice email to seller ${sellerId}:`,
        error,
      );
    }

    return finalInvoice;
  }

  /**
   * Send invoice email to seller
   */
  private async sendInvoiceEmail(
    email: string,
    invoice: Invoice,
  ): Promise<void> {
    try {
      const fromEmail =
        this.configService.get<string>('SENDGRID_FROM_EMAIL') ||
        'noreply@pazarone.co';
      const fromName =
        this.configService.get<string>('SENDGRID_FROM_NAME') || 'PazarOne';
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') || 'https://pazarone.co';

      // Format dates
      const weekStartDate = new Date(invoice.weekStartDate).toLocaleDateString(
        'en-US',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
      );
      const weekEndDate = new Date(invoice.weekEndDate).toLocaleDateString(
        'en-US',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
      );
      const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Build invoice items table HTML
      let itemsTableHtml = '';
      if (invoice.items && invoice.items.length > 0) {
        itemsTableHtml = `
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Order #</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Delivery Date</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Product Price</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Platform Fee</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Affiliate Fee</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Total Owed</th>
              </tr>
            </thead>
            <tbody>
        `;

        for (const item of invoice.items) {
          const deliveryDate = new Date(item.deliveryDate).toLocaleDateString(
            'en-US',
            {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            },
          );

          // Parse decimal values (they come from DB as strings)
          const productPriceMKD =
            item.productPriceMKD !== null && item.productPriceMKD !== undefined
              ? parseFloat(item.productPriceMKD.toString())
              : null;
          const productPriceEUR =
            item.productPriceEUR !== null && item.productPriceEUR !== undefined
              ? parseFloat(item.productPriceEUR.toString())
              : null;
          const productPrice =
            productPriceMKD !== null
              ? `${productPriceMKD.toFixed(2)} MKD`
              : productPriceEUR !== null
                ? `${productPriceEUR.toFixed(2)} EUR`
                : parseFloat(item.productPrice.toString()).toFixed(2);

          const platformFeeMKD =
            item.platformFeeMKD !== null && item.platformFeeMKD !== undefined
              ? parseFloat(item.platformFeeMKD.toString())
              : null;
          const platformFeeEUR =
            item.platformFeeEUR !== null && item.platformFeeEUR !== undefined
              ? parseFloat(item.platformFeeEUR.toString())
              : null;
          const platformFee =
            platformFeeMKD !== null
              ? `${platformFeeMKD.toFixed(2)} MKD`
              : platformFeeEUR !== null
                ? `${platformFeeEUR.toFixed(2)} EUR`
                : parseFloat(item.platformFee.toString()).toFixed(2);

          const affiliateFeeMKD =
            item.affiliateFeeMKD !== null && item.affiliateFeeMKD !== undefined
              ? parseFloat(item.affiliateFeeMKD.toString())
              : null;
          const affiliateFeeEUR =
            item.affiliateFeeEUR !== null && item.affiliateFeeEUR !== undefined
              ? parseFloat(item.affiliateFeeEUR.toString())
              : null;
          const affiliateFeeValue = parseFloat(item.affiliateFee.toString());
          const affiliateFee =
            affiliateFeeValue > 0
              ? affiliateFeeMKD !== null
                ? `${affiliateFeeMKD.toFixed(2)} MKD`
                : affiliateFeeEUR !== null
                  ? `${affiliateFeeEUR.toFixed(2)} EUR`
                  : affiliateFeeValue.toFixed(2)
              : '-';

          const totalOwedMKD =
            item.totalOwedMKD !== null && item.totalOwedMKD !== undefined
              ? parseFloat(item.totalOwedMKD.toString())
              : null;
          const totalOwedEUR =
            item.totalOwedEUR !== null && item.totalOwedEUR !== undefined
              ? parseFloat(item.totalOwedEUR.toString())
              : null;
          const totalOwed =
            totalOwedMKD !== null
              ? `${totalOwedMKD.toFixed(2)} MKD`
              : totalOwedEUR !== null
                ? `${totalOwedEUR.toFixed(2)} EUR`
                : parseFloat(item.totalOwed.toString()).toFixed(2);

          const platformFeePercent = parseFloat(
            item.platformFeePercent.toString(),
          ).toFixed(2);
          const affiliateFeePercentText =
            item.affiliateFeePercent !== null &&
            item.affiliateFeePercent !== undefined
              ? ` (${parseFloat(item.affiliateFeePercent.toString()).toFixed(2)}%)`
              : '';

          itemsTableHtml += `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">${item.orderNumber}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${deliveryDate}</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${productPrice}</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${platformFee} (${platformFeePercent}%)</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${affiliateFee}${affiliateFeePercentText}</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #ddd; font-weight: bold;">${totalOwed}</td>
            </tr>
          `;
        }

        itemsTableHtml += `
            </tbody>
          </table>
        `;
      }

      // Format total amounts (parse decimal values from DB)
      let totalAmountText = '';
      const totalAmountMKD =
        invoice.totalAmountMKD !== null && invoice.totalAmountMKD !== undefined
          ? parseFloat(invoice.totalAmountMKD.toString())
          : null;
      const totalAmountEUR =
        invoice.totalAmountEUR !== null && invoice.totalAmountEUR !== undefined
          ? parseFloat(invoice.totalAmountEUR.toString())
          : null;

      if (totalAmountMKD !== null && totalAmountEUR !== null) {
        totalAmountText = `${totalAmountMKD.toFixed(2)} MKD + ${totalAmountEUR.toFixed(2)} EUR`;
      } else if (totalAmountMKD !== null) {
        totalAmountText = `${totalAmountMKD.toFixed(2)} MKD`;
      } else if (totalAmountEUR !== null) {
        totalAmountText = `${totalAmountEUR.toFixed(2)} EUR`;
      } else {
        totalAmountText = parseFloat(invoice.totalAmount.toString()).toFixed(2);
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Weekly Invoice - ${invoice.invoiceNumber}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin-top: 0;">Weekly Invoice</h1>
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Week Period:</strong> ${weekStartDate} - ${weekEndDate}</p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDate}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #e67e22; font-weight: bold;">${invoice.status.toUpperCase()}</span></p>
          </div>

          <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Invoice Summary</h2>
            <p><strong>Total Orders:</strong> ${invoice.orderCount}</p>
            <p><strong>Total Amount Owed:</strong> <span style="font-size: 1.2em; font-weight: bold; color: #e74c3c;">${totalAmountText}</span></p>
          </div>

          <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Order Details</h2>
            ${itemsTableHtml}
          </div>

          <div style="background-color: #fff3cd; padding: 20px; border-left: 4px solid #ffc107; border-radius: 4px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #856404;">Payment Deadline</h3>
            <p style="margin: 0;">Please ensure payment is received by <strong>${dueDate}</strong>. Late payments may result in account restrictions.</p>
          </div>

          <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0;">To view your invoice and make payment, please log in to your seller dashboard.</p>
            <p style="margin: 10px 0 0 0;"><a href="${frontendUrl}/en/seller/invoices" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 10px;">View Invoice</a></p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #6c757d; font-size: 0.9em;">
            <p>This is an automated email from PazarOne. Please do not reply to this email.</p>
            <p>If you have any questions, please contact our support team through your seller dashboard.</p>
          </div>
        </body>
        </html>
      `;

      const text = `
Weekly Invoice - ${invoice.invoiceNumber}

Invoice Details:
- Invoice Number: ${invoice.invoiceNumber}
- Week Period: ${weekStartDate} - ${weekEndDate}
- Due Date: ${dueDate}
- Status: ${invoice.status.toUpperCase()}

Summary:
- Total Orders: ${invoice.orderCount}
- Total Amount Owed: ${totalAmountText}

Order Details:
${
  invoice.items
    ?.map((item) => {
      const deliveryDate = new Date(item.deliveryDate).toLocaleDateString(
        'en-US',
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
      );
      // Parse decimal values (they come from DB as strings)
      const itemProductPriceMKD =
        item.productPriceMKD !== null && item.productPriceMKD !== undefined
          ? parseFloat(item.productPriceMKD.toString())
          : null;
      const itemProductPriceEUR =
        item.productPriceEUR !== null && item.productPriceEUR !== undefined
          ? parseFloat(item.productPriceEUR.toString())
          : null;
      const productPrice =
        itemProductPriceMKD !== null
          ? `${itemProductPriceMKD.toFixed(2)} MKD`
          : itemProductPriceEUR !== null
            ? `${itemProductPriceEUR.toFixed(2)} EUR`
            : parseFloat(item.productPrice.toString()).toFixed(2);

      const itemPlatformFeeMKD =
        item.platformFeeMKD !== null && item.platformFeeMKD !== undefined
          ? parseFloat(item.platformFeeMKD.toString())
          : null;
      const itemPlatformFeeEUR =
        item.platformFeeEUR !== null && item.platformFeeEUR !== undefined
          ? parseFloat(item.platformFeeEUR.toString())
          : null;
      const platformFee =
        itemPlatformFeeMKD !== null
          ? `${itemPlatformFeeMKD.toFixed(2)} MKD`
          : itemPlatformFeeEUR !== null
            ? `${itemPlatformFeeEUR.toFixed(2)} EUR`
            : parseFloat(item.platformFee.toString()).toFixed(2);

      const itemAffiliateFeeMKD =
        item.affiliateFeeMKD !== null && item.affiliateFeeMKD !== undefined
          ? parseFloat(item.affiliateFeeMKD.toString())
          : null;
      const itemAffiliateFeeEUR =
        item.affiliateFeeEUR !== null && item.affiliateFeeEUR !== undefined
          ? parseFloat(item.affiliateFeeEUR.toString())
          : null;
      const affiliateFeeValue = parseFloat(item.affiliateFee.toString());
      const affiliateFee =
        affiliateFeeValue > 0
          ? itemAffiliateFeeMKD !== null
            ? `${itemAffiliateFeeMKD.toFixed(2)} MKD`
            : itemAffiliateFeeEUR !== null
              ? `${itemAffiliateFeeEUR.toFixed(2)} EUR`
              : affiliateFeeValue.toFixed(2)
          : '-';

      const itemTotalOwedMKD =
        item.totalOwedMKD !== null && item.totalOwedMKD !== undefined
          ? parseFloat(item.totalOwedMKD.toString())
          : null;
      const itemTotalOwedEUR =
        item.totalOwedEUR !== null && item.totalOwedEUR !== undefined
          ? parseFloat(item.totalOwedEUR.toString())
          : null;
      const totalOwed =
        itemTotalOwedMKD !== null
          ? `${itemTotalOwedMKD.toFixed(2)} MKD`
          : itemTotalOwedEUR !== null
            ? `${itemTotalOwedEUR.toFixed(2)} EUR`
            : parseFloat(item.totalOwed.toString()).toFixed(2);
      const textPlatformFeePercent = parseFloat(
        item.platformFeePercent.toString(),
      ).toFixed(2);
      const textAffiliateFeePercent =
        item.affiliateFeePercent !== null &&
        item.affiliateFeePercent !== undefined
          ? parseFloat(item.affiliateFeePercent.toString()).toFixed(2)
          : null;
      return `- Order ${item.orderNumber} (Delivered: ${deliveryDate}): ${productPrice} | Platform Fee: ${platformFee} (${textPlatformFeePercent}%) | Affiliate Fee: ${affiliateFee}${textAffiliateFeePercent ? ` (${textAffiliateFeePercent}%)` : ''} | Total Owed: ${totalOwed}`;
    })
    .join('\n') || 'No items'
}

Payment Deadline: ${dueDate}

Please ensure payment is received by the due date. Late payments may result in account restrictions.

To view your invoice and make payment, please log in to your seller dashboard:
${frontendUrl}/en/seller/invoices

This is an automated email from PazarOne. Please do not reply to this email.
      `.trim();

      const msg = {
        to: email,
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject: `Weekly Invoice ${invoice.invoiceNumber} - Payment Due ${dueDate}`,
        html,
        text,
      };

      await sgMail.send(msg);
      this.logger.log(
        `Invoice email sent to ${email} for invoice ${invoice.invoiceNumber}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send invoice email to ${email}:`, error);
      // Don't throw - email failure shouldn't break invoice generation
    }
  }

  /**
   * Get invoices for a seller
   */
  async getSellerInvoices(
    sellerId: string,
    page: number = 1,
    limit: number = 20,
    status?: InvoiceStatus,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .where('invoice.sellerId = :sellerId', { sellerId })
      .orderBy('invoice.weekStartDate', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('invoice.status = :status', { status });
    }

    const [invoices, total] = await queryBuilder.getManyAndCount();

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string, sellerId?: string): Promise<Invoice> {
    const where: any = { id: invoiceId };
    if (sellerId) {
      where.sellerId = sellerId;
    }

    const invoice = await this.invoiceRepository.findOne({
      where,
      relations: ['items', 'items.order', 'seller'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  /**
   * Mark invoice as paid
   */
  async markInvoiceAsPaid(
    invoiceId: string,
    sellerId: string,
    paymentNotes?: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, sellerId },
      relations: ['items'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already marked as paid');
    }

    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    invoice.paymentNotes = paymentNotes || null;

    // Update orders to mark as paid
    const orderIds = invoice.items.map((item) => item.orderId);
    await this.ordersRepository.update(
      { id: In(orderIds) },
      {
        sellerPaid: true,
        paymentSettledAt: new Date(),
      },
    );

    // Check and update payment restriction status
    await this.updateSellerPaymentRestriction(sellerId);

    const savedInvoice = await this.invoiceRepository.save(invoice);

    return savedInvoice;
  }

  /**
   * Mark invoice as paid (admin version - no sellerId check)
   */
  async markInvoiceAsPaidByAdmin(
    invoiceId: string,
    paymentNotes?: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['items'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already marked as paid');
    }

    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    invoice.paymentNotes = paymentNotes || null;

    // Update orders to mark as paid
    const orderIds = invoice.items.map((item) => item.orderId);
    await this.ordersRepository.update(
      { id: In(orderIds) },
      {
        sellerPaid: true,
        paymentSettledAt: new Date(),
      },
    );

    // Check and update payment restriction status
    await this.updateSellerPaymentRestriction(invoice.sellerId);

    const savedInvoice = await this.invoiceRepository.save(invoice);

    return savedInvoice;
  }

  /**
   * Update invoice status to OVERDUE if past due date
   * Should be called periodically (e.g., daily)
   */
  async updateOverdueInvoices(): Promise<void> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const overdueInvoices = await this.invoiceRepository.find({
      where: {
        status: InvoiceStatus.PENDING,
      },
    });

    let updatedCount = 0;

    for (const invoice of overdueInvoices) {
      if (invoice.dueDate < now) {
        invoice.status = InvoiceStatus.OVERDUE;
        await this.invoiceRepository.save(invoice);
        updatedCount++;

        // Update seller payment restriction
        await this.updateSellerPaymentRestriction(invoice.sellerId);
      }
    }

    this.logger.log(`Updated ${updatedCount} invoices to OVERDUE status`);
  }

  /**
   * Check if seller has overdue invoices and update restriction status
   * NOTE: Automatic freezing is disabled - only manual admin freeze/unfreeze works
   */
  async updateSellerPaymentRestriction(sellerId: string): Promise<void> {
    const overdueInvoices = await this.invoiceRepository.count({
      where: {
        sellerId,
        status: InvoiceStatus.OVERDUE,
      },
    });

    const sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    if (!sellerSettings) {
      return;
    }

    const shouldBeRestricted = overdueInvoices > 0;

    // AUTOMATIC FREEZING DISABLED - Only manual admin freeze works
    // if (shouldBeRestricted && !sellerSettings.paymentRestricted) {
    //   // Apply restrictions
    //   sellerSettings.paymentRestricted = true;
    //   sellerSettings.paymentRestrictedAt = new Date();
    //   await this.sellerSettingsRepository.save(sellerSettings);

    //   // Hide all products
    //   await this.productsRepository.update(
    //     { sellerId, status: ProductStatus.ACTIVE },
    //     { status: ProductStatus.INACTIVE },
    //   );

    //   this.logger.warn(
    //     `Payment restriction applied to seller ${sellerId} due to overdue invoices`,
    //   );
    // }

    // Keep unfreeze logic - automatically unfreeze when all invoices are paid
    if (!shouldBeRestricted && sellerSettings.paymentRestricted) {
      // Remove restrictions
      sellerSettings.paymentRestricted = false;
      sellerSettings.paymentRestrictedAt = null;
      await this.sellerSettingsRepository.save(sellerSettings);

      // Restore products (only if they were active before)
      // Note: We can't easily restore to ACTIVE without knowing previous state
      // This might need manual intervention or a history table
      // For now, we just remove the restriction flag

      this.logger.log(`Payment restriction removed from seller ${sellerId}`);
    }
  }

  /**
   * Check if seller can create orders (no overdue invoices)
   */
  async canSellerCreateOrders(sellerId: string): Promise<boolean> {
    const sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    if (!sellerSettings) {
      return true; // If no settings, allow (shouldn't happen)
    }

    return !sellerSettings.paymentRestricted;
  }

  /**
   * Generate invoice for a specific seller (admin-triggered)
   * Includes all delivered COD orders that are not yet paid and not already in an invoice
   */
  async generateInvoiceForSpecificSeller(sellerId: string): Promise<Invoice> {
    // Verify seller exists and is a seller
    const seller = await this.usersRepository.findOne({
      where: { id: sellerId, userType: UserType.SELLER },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Get all delivered COD orders for this seller that are not yet paid
    const allOrders = await this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.sellerId = :sellerId', { sellerId })
      .andWhere(
        '(order.paymentMethod = :paymentMethod OR order.paymentMethod IS NULL)',
        {
          paymentMethod: 'cod',
        },
      )
      .andWhere('order.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere('order.sellerPaid = :sellerPaid', { sellerPaid: false })
      .getMany();

    if (allOrders.length === 0) {
      throw new BadRequestException(
        'No delivered COD orders found for this seller that are not yet paid',
      );
    }

    // Get all order IDs that are already in invoices
    const orderIds = allOrders.map((order) => order.id);
    const existingInvoiceItems = await this.invoiceItemRepository.find({
      where: {
        orderId: In(orderIds),
      },
      relations: ['invoice'],
    });

    // Get order IDs that are already in invoices
    const orderIdsInInvoices = new Set(
      existingInvoiceItems.map((item) => item.orderId),
    );

    // Filter out orders that are already in invoices
    const orders = allOrders.filter(
      (order) => !orderIdsInInvoices.has(order.id),
    );

    if (orders.length === 0) {
      throw new BadRequestException(
        'All delivered COD orders for this seller are already included in existing invoices',
      );
    }

    if (orders.length < allOrders.length) {
      this.logger.log(
        `Filtered out ${allOrders.length - orders.length} orders that are already in invoices. Processing ${orders.length} orders.`,
      );
    }

    // Determine the date range based on order delivery dates
    // Use the earliest and latest delivery dates from the orders
    const deliveryDates = orders.map(
      (order) => order.updatedAt || order.createdAt,
    );
    const earliestDate = new Date(
      Math.min(...deliveryDates.map((d) => d.getTime())),
    );
    const latestDate = new Date(
      Math.max(...deliveryDates.map((d) => d.getTime())),
    );

    // Get the Monday of the week containing the earliest order and Sunday of the week containing the latest
    const weekStart = this.getMondayOfWeek(earliestDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = this.getSundayOfWeek(latestDate);
    weekEnd.setHours(23, 59, 59, 999);

    // Use current date as invoice date
    const invoiceDate = new Date();
    invoiceDate.setHours(0, 0, 0, 0);

    this.logger.log(
      `Admin-triggered invoice generation for seller ${sellerId} with ${orders.length} orders`,
    );

    // Generate the invoice
    const invoice = await this.generateInvoiceForSeller(
      sellerId,
      orders,
      weekStart,
      weekEnd,
      invoiceDate,
    );

    return invoice;
  }
}
