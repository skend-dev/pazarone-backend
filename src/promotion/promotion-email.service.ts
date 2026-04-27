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
   * Get users who have opted in to promotional emails.
   * Audience groups are filtered by the platform `promotionEmailTarget*` flags.
   */
  async getOptedInRecipients(audience?: {
    customers: boolean;
    sellers: boolean;
    affiliates: boolean;
  }): Promise<User[]> {
    const aud = audience ?? { customers: true, sellers: true, affiliates: true };

    const results = await Promise.all([
      aud.customers ? this.getOptedInCustomers() : [],
      aud.sellers ? this.getOptedInSellers() : [],
      aud.affiliates ? this.getOptedInAffiliates() : [],
    ]);

    const byId = new Map<string, User>();
    for (const u of results.flat()) {
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
   * Get flash deal products using a multi-signal scoring algorithm.
   *
   * Signals and weights:
   *  30% — discount depth     (bigger savings = more compelling)
   *  25% — rotation freshness (products sent <7 days ago are heavily penalised)
   *  20% — urgency            (sale expiring soon scores higher)
   *  15% — quality            (rating × √reviewCount, normalised)
   *  10% — popularity         (log-normalised sales + views)
   *
   * After scoring, category diversity is enforced: at most 2 products per
   * category are included in the final selection.
   */
  async getFlashDealProducts(limit = 8): Promise<
    Array<{
      id: string;
      name: string;
      price: number | null;
      salePrice: number | null;
      imageUrl: string | null;
      productUrl: string;
    }>
  > {
    // 1. Fetch a wide pool of currently-on-sale products
    const pool = await this.productsService.getFlashDealPool(200);
    if (pool.length === 0) return [];

    // 2. Load recently featured product IDs from past automated flash-deal broadcasts
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentBroadcasts = await this.broadcastRepository
      .createQueryBuilder('b')
      .select(['b.featuredProductIds', 'b.createdAt'])
      .where('b.broadcastType = :type', { type: 'automated_flash_deals' })
      .andWhere('b.createdAt >= :since', { since: thirtyDaysAgo })
      .orderBy('b.createdAt', 'DESC')
      .getMany();

    const sentLast7d = new Set<string>();
    const sentLast30d = new Set<string>();
    for (const broadcast of recentBroadcasts) {
      const ids: string[] = broadcast.featuredProductIds ?? [];
      const isRecent = broadcast.createdAt >= sevenDaysAgo;
      for (const id of ids) {
        sentLast30d.add(id);
        if (isRecent) sentLast7d.add(id);
      }
    }

    // 3. Compute normalisation base for popularity (log scale)
    const maxPopRaw = pool.reduce((max, p) => {
      const raw = (p.sales ?? 0) * 2 + (p.views ?? 0);
      return raw > max ? raw : max;
    }, 1);

    // 4. Compute per-product quality normalisation base
    const maxQualityRaw = pool.reduce((max, p) => {
      const rating = p.rating != null ? Number(p.rating) : 0;
      const reviews = p.reviewsCount ?? 0;
      const raw = rating > 0 ? (rating / 5) * Math.sqrt(reviews) : 0;
      return raw > max ? raw : max;
    }, 0.001);

    // 5. Score every product in the pool
    const now = Date.now();
    const scored = pool.map((p) => {
      const regularPrice =
        p.regularPrice != null ? Number(p.regularPrice) : Number(p.price);
      const salePrice = p.salePrice != null ? Number(p.salePrice) : null;

      // Discount depth (0–1)
      const discountScore =
        salePrice != null && regularPrice > 0 && salePrice < regularPrice
          ? Math.min((regularPrice - salePrice) / regularPrice, 1)
          : 0;

      // Rotation freshness (0–1): penalise recently sent products
      const rotationScore = sentLast7d.has(p.id)
        ? 0.05
        : sentLast30d.has(p.id)
          ? 0.40
          : 1.0;

      // Urgency (0–1): sale expiring soon is more compelling
      let urgencyScore = 0.30; // on sale with no expiry = moderate urgency
      if (p.salePriceExpiresAt) {
        const hoursLeft =
          (new Date(p.salePriceExpiresAt).getTime() - now) / (1000 * 3600);
        if (hoursLeft <= 24) urgencyScore = 1.0;
        else if (hoursLeft <= 72) urgencyScore = 0.80;
        else if (hoursLeft <= 168) urgencyScore = 0.60;
        else urgencyScore = 0.40;
      }

      // Quality (0–1): rating × √reviewCount, normalised to pool max
      const rating = p.rating != null ? Number(p.rating) : 0;
      const reviews = p.reviewsCount ?? 0;
      const qualityRaw = rating > 0 ? (rating / 5) * Math.sqrt(reviews) : 0;
      const qualityScore = qualityRaw / maxQualityRaw;

      // Popularity (0–1): log-normalised sales + views
      const popRaw = (p.sales ?? 0) * 2 + (p.views ?? 0);
      const popularityScore =
        Math.log(popRaw + 1) / Math.log(maxPopRaw + 1);

      const finalScore =
        0.30 * discountScore +
        0.25 * rotationScore +
        0.20 * urgencyScore +
        0.15 * qualityScore +
        0.10 * popularityScore;

      return { p, finalScore };
    });

    // 6. Sort by score descending
    scored.sort((a, b) => b.finalScore - a.finalScore);

    // 7. Category-diversity pass: allow at most 2 products per category
    const categoryCounts = new Map<string | null, number>();
    const selected: typeof pool = [];
    for (const { p } of scored) {
      const catId = p.categoryId ?? null;
      const count = categoryCounts.get(catId) ?? 0;
      if (count < 2) {
        selected.push(p);
        categoryCounts.set(catId, count + 1);
        if (selected.length >= limit) break;
      }
    }

    // 8. Format for email
    return this.formatProducts(
      selected.map((p) => ({
        id: p.id,
        name: p.name,
        price:
          p.regularPrice != null
            ? Number(p.regularPrice)
            : p.price != null
              ? Number(p.price)
              : null,
        salePrice: p.salePrice != null ? Number(p.salePrice) : null,
        images: p.images,
      })),
    );
  }

  /**
   * Get new arrival products: newest products (no sale filter)
   */
  async getNewArrivalProducts(limit = 8): Promise<
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
    for (const p of landing.newArrivals.slice(0, limit)) {
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
   * Send flash deal emails (popular products on sale) to opted-in recipients.
   */
  async sendFlashDealEmails(opts: {
    maxProducts: number;
    audience: { customers: boolean; sellers: boolean; affiliates: boolean };
  }): Promise<{ sent: number; skipped: boolean; reason?: string }> {
    const products = await this.getFlashDealProducts(opts.maxProducts);
    if (products.length === 0) {
      return { sent: 0, skipped: true, reason: 'No products on sale' };
    }

    const recipients = await this.getOptedInRecipients(opts.audience);
    if (recipients.length === 0) {
      return { sent: 0, skipped: true, reason: 'No opted-in recipients' };
    }

    const title = `Flash Deals Today - ${products.length} products on sale | PazarOne`;
    const message =
      "Check out today's best deals. Limited time offers – shop before they're gone!";

    const emailSent = await this.sendPromotionEmails(recipients, products, title, message);

    const targetAudience: string[] = [
      ...(opts.audience.customers ? ['customer'] : []),
      ...(opts.audience.sellers ? ['seller'] : []),
      ...(opts.audience.affiliates ? ['affiliate'] : []),
    ];
    await this.broadcastRepository.save(
      this.broadcastRepository.create({
        title,
        message,
        broadcastType: 'automated_flash_deals',
        targetAudience,
        deliveryMethod: 'email',
        featuredProductIds: products.map((p) => p.id),
        emailSent,
        notificationsCreated: 0,
        isAutomated: true,
        createdById: null,
      }),
    );

    this.logger.log(`Flash deal emails sent: ${emailSent} to opted-in recipients`);
    return { sent: emailSent, skipped: false };
  }

  /**
   * Send new arrivals emails (newest products) to opted-in recipients.
   */
  async sendNewArrivalEmails(opts: {
    maxProducts: number;
    audience: { customers: boolean; sellers: boolean; affiliates: boolean };
  }): Promise<{ sent: number; skipped: boolean; reason?: string }> {
    const products = await this.getNewArrivalProducts(opts.maxProducts);
    if (products.length === 0) {
      return { sent: 0, skipped: true, reason: 'No new products' };
    }

    const recipients = await this.getOptedInRecipients(opts.audience);
    if (recipients.length === 0) {
      return { sent: 0, skipped: true, reason: 'No opted-in recipients' };
    }

    const title = `New Arrivals - ${products.length} fresh products | PazarOne`;
    const message = "Discover what's new on PazarOne. Fresh products just for you!";

    const emailSent = await this.sendPromotionEmails(recipients, products, title, message);

    const targetAudience: string[] = [
      ...(opts.audience.customers ? ['customer'] : []),
      ...(opts.audience.sellers ? ['seller'] : []),
      ...(opts.audience.affiliates ? ['affiliate'] : []),
    ];
    await this.broadcastRepository.save(
      this.broadcastRepository.create({
        title,
        message,
        broadcastType: 'automated_new_arrivals',
        targetAudience,
        deliveryMethod: 'email',
        featuredProductIds: products.map((p) => p.id),
        emailSent,
        notificationsCreated: 0,
        isAutomated: true,
        createdById: null,
      }),
    );

    this.logger.log(`New arrival emails sent: ${emailSent} to opted-in recipients`);
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

    const [flashEnabled, newArrivalsEnabled, maxProducts, audience] =
      await Promise.all([
        this.platformSettingsService.getPromotionEmailsFlashDealsEnabled(),
        this.platformSettingsService.getPromotionEmailsNewArrivalsEnabled(),
        this.platformSettingsService.getPromotionEmailMaxProducts(),
        this.platformSettingsService.getPromotionEmailAudience(),
      ]);

    const opts = { maxProducts, audience };

    const flashResult = flashEnabled
      ? await this.sendFlashDealEmails(opts)
      : { sent: 0, skipped: true, reason: 'Flash deals disabled' };
    const newArrivalsResult = newArrivalsEnabled
      ? await this.sendNewArrivalEmails(opts)
      : { sent: 0, skipped: true, reason: 'New arrivals disabled' };

    return { flashDeals: flashResult, newArrivals: newArrivalsResult };
  }
}
