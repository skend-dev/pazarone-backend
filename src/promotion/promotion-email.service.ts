import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserType } from '../users/entities/user.entity';
import { CustomerNotificationPreferences } from '../customer/entities/customer-notification-preferences.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { AffiliateReferral } from '../affiliate/entities/affiliate-referral.entity';
import { Broadcast } from '../admin/entities/broadcast.entity';
import { ProductsService } from '../products/products.service';
import { EmailService } from '../auth/services/email.service';
import { PlatformSettingsService } from '../platform/platform-settings.service';

const FLASH_DEAL_LIMIT = 8;
const defaultLocale = 'en';

@Injectable()
export class PromotionEmailService {
  private readonly logger = new Logger(PromotionEmailService.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(CustomerNotificationPreferences)
    private readonly customerPrefsRepository: Repository<CustomerNotificationPreferences>,
    @InjectRepository(SellerSettings)
    private readonly sellerSettingsRepository: Repository<SellerSettings>,
    @InjectRepository(AffiliateReferral)
    private readonly affiliateReferralRepository: Repository<AffiliateReferral>,
    @InjectRepository(Broadcast)
    private readonly broadcastRepository: Repository<Broadcast>,
    private readonly productsService: ProductsService,
    private readonly emailService: EmailService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://pazarone.co';
  }

  /**
   * Get users who have opted in to promotional emails:
   * - Customers: promotionalEmails = true (default true when no prefs row)
   * - Sellers: notificationsPromotions = true
   * - Affiliates: all (no preference yet)
   */
  async getOptedInRecipients(): Promise<User[]> {
    const [customers, sellers, affiliates] = await Promise.all([
      this.getOptedInCustomers(),
      this.getOptedInSellers(),
      this.getOptedInAffiliates(),
    ]);

    const byId = new Map<string, User>();
    for (const u of [...customers, ...sellers, ...affiliates]) {
      if (u.email && !byId.has(u.id)) {
        byId.set(u.id, u);
      }
    }
    return Array.from(byId.values());
  }

  private async getOptedInCustomers(): Promise<User[]> {
    const rows = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoin(
        CustomerNotificationPreferences,
        'prefs',
        'prefs.customerId = user.id',
      )
      .where('user.userType = :type', { type: UserType.CUSTOMER })
      .andWhere('user.email IS NOT NULL')
      .andWhere('user.email != :empty', { empty: '' })
      .andWhere(
        '(prefs.promotionalEmails IS NULL OR prefs.promotionalEmails = true)',
      )
      .select(['user.id', 'user.email', 'user.name', 'user.userType'])
      .getMany();
    return rows;
  }

  private async getOptedInSellers(): Promise<User[]> {
    const rows = await this.usersRepository
      .createQueryBuilder('user')
      .innerJoin(SellerSettings, 'ss', 'ss.sellerId = user.id')
      .where('user.userType = :type', { type: UserType.SELLER })
      .andWhere('user.email IS NOT NULL')
      .andWhere('user.email != :empty', { empty: '' })
      .andWhere('ss.notificationsPromotions = true')
      .select(['user.id', 'user.email', 'user.name', 'user.userType'])
      .getMany();
    return rows;
  }

  private async getOptedInAffiliates(): Promise<User[]> {
    return this.usersRepository.find({
      where: { userType: UserType.AFFILIATE },
      select: ['id', 'email', 'name', 'userType'],
    });
  }

  private formatProducts(
    products: Array<{
      id: string;
      name: string;
      price: number | null;
      salePrice: number | null;
      images: unknown;
    }>,
  ): Array<{
    id: string;
    name: string;
    price: number | null;
    salePrice: number | null;
    imageUrl: string | null;
    productUrl: string;
  }> {
    const getImageUrl = (imgs: unknown): string | null => {
      if (!imgs) return null;
      if (Array.isArray(imgs)) {
        const first = imgs[0];
        return typeof first === 'string' ? first : null;
      }
      return null;
    };
    const path = `/${defaultLocale}/product`;
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      salePrice: p.salePrice,
      imageUrl: getImageUrl(p.images),
      productUrl: `${this.frontendUrl}${path}/${p.id}`,
    }));
  }

  /**
   * Get flash deal products: popular + on sale only, limit 8
   */
  async getFlashDealProducts(): Promise<
    Array<{
      id: string;
      name: string;
      price: number | null;
      salePrice: number | null;
      imageUrl: string | null;
      productUrl: string;
    }>
  > {
    const landing = await this.productsService.getLanding();
    const formatted: Array<{ id: string; name: string; price: number | null; salePrice: number | null; images: unknown }> =
      [];
    for (const p of landing.flashDeals.slice(0, FLASH_DEAL_LIMIT)) {
      const price =
        p.regularPrice != null
          ? Number(p.regularPrice)
          : p.price != null
            ? Number(p.price)
            : null;
      formatted.push({
        id: p.id,
        name: p.name,
        price,
        salePrice: p.salePrice != null ? Number(p.salePrice) : null,
        images: p.images,
      });
    }
    return this.formatProducts(formatted);
  }

  /**
   * Get new arrival products: newest products (no sale filter), limit 8
   */
  async getNewArrivalProducts(): Promise<
    Array<{
      id: string;
      name: string;
      price: number | null;
      salePrice: number | null;
      imageUrl: string | null;
      productUrl: string;
    }>
  > {
    const landing = await this.productsService.getLanding();
    const formatted: Array<{ id: string; name: string; price: number | null; salePrice: number | null; images: unknown }> =
      [];
    for (const p of landing.newArrivals.slice(0, FLASH_DEAL_LIMIT)) {
      const price =
        p.regularPrice != null
          ? Number(p.regularPrice)
          : p.price != null
            ? Number(p.price)
            : null;
      formatted.push({
        id: p.id,
        name: p.name,
        price,
        salePrice: p.salePrice != null ? Number(p.salePrice) : null,
        images: p.images,
      });
    }
    return this.formatProducts(formatted);
  }

  private buildProductUrl(productId: string, referralCode: string | null): string {
    const path = `/${defaultLocale}/product/${productId}`;
    const base = `${this.frontendUrl}${path}`;
    if (referralCode) {
      return `${base}?ref=${encodeURIComponent(referralCode)}`;
    }
    return base;
  }

  private async getReferralCodeForAffiliate(affiliateId: string): Promise<string | null> {
    const ref = await this.affiliateReferralRepository.findOne({
      where: { affiliateId, isActive: true },
      select: ['referralCode'],
    });
    return ref?.referralCode ?? null;
  }

  /**
   * Send flash deal emails (popular products on sale) to all opted-in recipients.
   */
  async sendFlashDealEmails(): Promise<{
    sent: number;
    skipped: boolean;
    reason?: string;
  }> {
    const products = await this.getFlashDealProducts();
    if (products.length === 0) {
      return { sent: 0, skipped: true, reason: 'No products on sale' };
    }

    const recipients = await this.getOptedInRecipients();
    if (recipients.length === 0) {
      return { sent: 0, skipped: true, reason: 'No opted-in recipients' };
    }

    const title = `Flash Deals Today - ${products.length} products on sale | PazarOne`;
    const message =
      "Check out today's best deals. Limited time offers – shop before they're gone!";

    const emailSent = await this.sendPromotionEmails(recipients, products, title, message);

    await this.broadcastRepository.save(
      this.broadcastRepository.create({
        title,
        message,
        broadcastType: 'automated_flash_deals',
        targetAudience: ['customer', 'seller', 'affiliate'],
        deliveryMethod: 'email',
        featuredProductIds: products.map((p) => p.id),
        emailSent,
        notificationsCreated: 0,
        isAutomated: true,
        createdById: null,
      }),
    );

    this.logger.log(
      `Flash deal emails sent: ${emailSent} to opted-in recipients`,
    );
    return { sent: emailSent, skipped: false };
  }

  /**
   * Send new arrivals emails (newest products) to all opted-in recipients.
   */
  async sendNewArrivalEmails(): Promise<{
    sent: number;
    skipped: boolean;
    reason?: string;
  }> {
    const products = await this.getNewArrivalProducts();
    if (products.length === 0) {
      return { sent: 0, skipped: true, reason: 'No new products' };
    }

    const recipients = await this.getOptedInRecipients();
    if (recipients.length === 0) {
      return { sent: 0, skipped: true, reason: 'No opted-in recipients' };
    }

    const title = `New Arrivals - ${products.length} fresh products | PazarOne`;
    const message =
      "Discover what's new on PazarOne. Fresh products just for you!";

    const emailSent = await this.sendPromotionEmails(recipients, products, title, message);

    await this.broadcastRepository.save(
      this.broadcastRepository.create({
        title,
        message,
        broadcastType: 'automated_new_arrivals',
        targetAudience: ['customer', 'seller', 'affiliate'],
        deliveryMethod: 'email',
        featuredProductIds: products.map((p) => p.id),
        emailSent,
        notificationsCreated: 0,
        isAutomated: true,
        createdById: null,
      }),
    );

    this.logger.log(
      `New arrival emails sent: ${emailSent} to opted-in recipients`,
    );
    return { sent: emailSent, skipped: false };
  }

  private async sendPromotionEmails(
    recipients: User[],
    products: Array<{
      id: string;
      name: string;
      price: number | null;
      salePrice: number | null;
      imageUrl: string | null;
      productUrl: string;
    }>,
    title: string,
    message: string,
  ): Promise<number> {
    let emailSent = 0;
    for (const user of recipients) {
      if (!user.email) continue;
      try {
        const useReferralCode = user.userType === UserType.AFFILIATE;
        const referralCode = useReferralCode
          ? await this.getReferralCodeForAffiliate(user.id)
          : null;
        const productPayload = products.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          salePrice: p.salePrice,
          imageUrl: p.imageUrl,
          productUrl: this.buildProductUrl(p.id, referralCode),
        }));
        await this.emailService.sendBroadcastAnnouncement(
          user.email,
          user.name || 'there',
          title,
          message,
          productPayload,
        );
        emailSent++;
      } catch (err) {
        this.logger.warn(
          `Failed to send promotion email to ${user.email}:`,
          err,
        );
      }
    }
    return emailSent;
  }

  /**
   * Orchestrate promotion emails: runs flash deals and/or new arrivals based on platform settings.
   * Call this from the scheduler.
   */
  async runScheduledPromotionEmails(): Promise<{
    flashDeals: { sent: number; skipped: boolean; reason?: string };
    newArrivals: { sent: number; skipped: boolean; reason?: string };
  }> {
    const enabled =
      await this.platformSettingsService.getAutomaticPromotionEmailsEnabled();
    if (!enabled) {
      return {
        flashDeals: { sent: 0, skipped: true, reason: 'Automatic promotions disabled' },
        newArrivals: { sent: 0, skipped: true, reason: 'Automatic promotions disabled' },
      };
    }

    const flashEnabled = await this.platformSettingsService.getPromotionEmailsFlashDealsEnabled();
    const newArrivalsEnabled = await this.platformSettingsService.getPromotionEmailsNewArrivalsEnabled();

    const flashResult = flashEnabled
      ? await this.sendFlashDealEmails()
      : { sent: 0, skipped: true, reason: 'Flash deals disabled' };
    const newArrivalsResult = newArrivalsEnabled
      ? await this.sendNewArrivalEmails()
      : { sent: 0, skipped: true, reason: 'New arrivals disabled' };

    return { flashDeals: flashResult, newArrivals: newArrivalsResult };
  }
}
