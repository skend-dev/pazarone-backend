import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserType } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { AffiliateReferral } from '../affiliate/entities/affiliate-referral.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../notifications/entities/notification.entity';
import { EmailService } from '../auth/services/email.service';
import {
  CreateBroadcastDto,
  UserRoleTargetAudienceType,
} from './dto/create-broadcast.dto';
import { Broadcast } from './entities/broadcast.entity';
import { MarketingContact } from '../marketing/entities/marketing-contact.entity';
import { normalizeMarketingGenderInput } from '../marketing/utils/marketing-gender';

const TARGET_TO_USER_TYPE: Record<UserRoleTargetAudienceType, UserType> = {
  affiliate: UserType.AFFILIATE,
  seller: UserType.SELLER,
  customer: UserType.CUSTOMER,
};

@Injectable()
export class AdminBroadcastService implements OnModuleInit {
  private readonly logger = new Logger(AdminBroadcastService.name);
  private readonly defaultLocale = 'en';
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(AffiliateReferral)
    private readonly affiliateReferralRepository: Repository<AffiliateReferral>,
    @InjectRepository(Broadcast)
    private readonly broadcastRepository: Repository<Broadcast>,
    @InjectRepository(MarketingContact)
    private readonly marketingContactRepository: Repository<MarketingContact>,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://pazarone.co';
  }

  /**
   * On startup, any broadcast left in 'processing' from a previous server
   * instance (crash / restart mid-send) is marked 'failed' so the frontend
   * never shows a perpetually spinning progress bar.
   */
  async onModuleInit() {
    try {
      const orphaned = await this.broadcastRepository.count({
        where: { status: 'processing' },
      });
      if (orphaned > 0) {
        await this.broadcastRepository
          .createQueryBuilder()
          .update()
          .set({ status: 'failed' })
          .where('"status" = :s', { s: 'processing' })
          .execute();
        this.logger.warn(
          `Marked ${orphaned} orphaned broadcast(s) as failed (server restarted mid-send)`,
        );
      }
    } catch (err) {
      // Non-fatal: column may not exist yet if migration hasn't run
      this.logger.warn('Could not clean up orphaned broadcasts on init:', err);
    }
  }

  /**
   * Resolve registered-user recipients by role (affiliate / seller / customer).
   * When `audienceGender` is set, **customers** are restricted to those with a
   * linked marketing_contact row whose gender matches (case-insensitive).
   * Affiliates and sellers are always included when selected — they have no gender on users.
   */
  async getUserRecipientsByTypes(
    roleTargets: UserRoleTargetAudienceType[],
    audienceGender?: string | null,
  ): Promise<User[]> {
    if (!roleTargets.length) return [];

    const gCanon = normalizeMarketingGenderInput(audienceGender);
    const hasGender = gCanon != null;

    const nonCustomerRoles = roleTargets.filter((t) => t !== 'customer');
    const includeCustomers = roleTargets.includes('customer');

    const parts: User[][] = [];

    if (nonCustomerRoles.length) {
      const userTypes = nonCustomerRoles.map((t) => TARGET_TO_USER_TYPE[t]);
      const rows = await this.usersRepository.find({
        where: { userType: In(userTypes) },
        select: ['id', 'email', 'name', 'userType'],
      });
      parts.push(rows);
    }

    if (includeCustomers) {
      if (hasGender) {
        const rows = await this.usersRepository
          .createQueryBuilder('u')
          .innerJoin(
            MarketingContact,
            'mc',
            "mc.userId = u.id AND mc.gender IS NOT NULL AND TRIM(mc.gender) != '' AND LOWER(TRIM(mc.gender)) = LOWER(TRIM(:gender))",
            { gender: gCanon },
          )
          .where('u.userType = :ct', { ct: UserType.CUSTOMER })
          .select(['u.id', 'u.email', 'u.name', 'u.userType'])
          .getMany();
        parts.push(rows);
      } else {
        const rows = await this.usersRepository.find({
          where: { userType: UserType.CUSTOMER },
          select: ['id', 'email', 'name', 'userType'],
        });
        parts.push(rows);
      }
    }

    return parts.flat();
  }

  /**
   * Get audience counts for affiliates, sellers, customers, and marketing
   * contacts with an email (not unsubscribed). Marketing count is prior to
   * deduplication with selected user roles at send time.
   */
  async getAudienceCounts(audienceGender?: string | null): Promise<{
    affiliates: number;
    sellers: number;
    customers: number;
    marketingAudienceWithEmail: number;
  }> {
    const gCanon = normalizeMarketingGenderInput(audienceGender);
    const hasGender = gCanon != null;

    const marketingQb = this.marketingContactRepository
      .createQueryBuilder('c')
      .where('c.email IS NOT NULL')
      .andWhere("TRIM(c.email) != ''")
      .andWhere('c.emailSuppressedAt IS NULL');
    if (hasGender) {
      marketingQb
        .andWhere('c.gender IS NOT NULL')
        .andWhere("TRIM(c.gender) != ''")
        .andWhere(
          "LOWER(TRIM(c.gender)) = LOWER(TRIM(:gender))",
          { gender: gCanon },
        );
    }

    const affiliatesP = this.usersRepository.count({
      where: { userType: UserType.AFFILIATE },
    });
    const sellersP = this.usersRepository.count({
      where: { userType: UserType.SELLER },
    });

    let customersP: Promise<number>;
    if (hasGender) {
      customersP = this.usersRepository
        .createQueryBuilder('u')
        .innerJoin(
          MarketingContact,
          'mc',
          "mc.userId = u.id AND mc.gender IS NOT NULL AND TRIM(mc.gender) != '' AND LOWER(TRIM(mc.gender)) = LOWER(TRIM(:gender))",
          { gender: gCanon },
        )
        .where('u.userType = :ct', { ct: UserType.CUSTOMER })
        .getCount();
    } else {
      customersP = this.usersRepository.count({
        where: { userType: UserType.CUSTOMER },
      });
    }

    const [affiliates, sellers, customers, marketingAudienceWithEmail] =
      await Promise.all([affiliatesP, sellersP, customersP, marketingQb.getCount()]);

    return {
      affiliates,
      sellers,
      customers,
      marketingAudienceWithEmail,
    };
  }

  /**
   * Fetch featured products for broadcast (id, name, price, salePrice, images)
   */
  async getFeaturedProducts(productIds: string[]): Promise<
    Array<{
      id: string;
      name: string;
      price: number | null;
      salePrice: number | null;
      imageUrl: string | null;
    }>
  > {
    if (!productIds?.length) return [];
    const products = await this.productsRepository.find({
      where: { id: In(productIds) },
      select: ['id', 'name', 'price', 'regularPrice', 'salePrice', 'images'],
    });
    return products.map((p) => {
      const images = this.normalizeImages(p.images);
      const price =
        p.regularPrice != null
          ? Number(p.regularPrice)
          : p.price != null
            ? Number(p.price)
            : null;
      const salePrice = p.salePrice != null ? Number(p.salePrice) : null;
      return {
        id: p.id,
        name: p.name,
        price,
        salePrice,
        imageUrl: images.length > 0 ? images[0] : null,
      };
    });
  }

  private normalizeImages(images: unknown): string[] {
    if (!images) return [];
    if (Array.isArray(images)) {
      return images
        .map((img: unknown) =>
          typeof img === 'string' ? img : (img as { url?: string })?.url,
        )
        .filter((url): url is string => typeof url === 'string');
    }
    if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images) as unknown;
        return Array.isArray(parsed) ? this.normalizeImages(parsed) : [];
      } catch {
        return images.startsWith('http') ? [images] : [];
      }
    }
    return [];
  }

  /**
   * Get referral code for an affiliate user (if any)
   */
  private async getReferralCodeForAffiliate(
    affiliateId: string,
  ): Promise<string | null> {
    const referral = await this.affiliateReferralRepository.findOne({
      where: { affiliateId, isActive: true },
      select: ['referralCode'],
    });
    return referral?.referralCode ?? null;
  }

  /**
   * Build product URL for a recipient (with ?ref= for affiliates when available)
   */
  private buildProductUrl(
    productId: string,
    referralCode: string | null,
  ): string {
    const path = `/${this.defaultLocale}/product/${productId}`;
    const base = `${this.frontendUrl}${path}`;
    if (referralCode) {
      return `${base}?ref=${encodeURIComponent(referralCode)}`;
    }
    return base;
  }

  /**
   * List sent broadcasts with pagination
   * @param isAutomated - when true, only automated; when false, only manual; undefined = all
   */
  async findAll(
    page: number = 1,
    limit: number = 20,
    isAutomated?: boolean,
  ): Promise<{
    broadcasts: Array<{
      id: string;
      title: string;
      message: string;
      broadcastType: string;
      targetAudience: string[];
      deliveryMethod: string;
      featuredProductIds: string[] | null;
      emailSent: number;
      notificationsCreated: number;
      isAutomated: boolean;
      createdAt: string;
      createdBy: { id: string; name: string; email: string };
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;
    const qb = this.broadcastRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.createdBy', 'createdBy')
      .orderBy('b.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (isAutomated === true) {
      qb.andWhere('b.isAutomated = :isAutomated', { isAutomated: true });
    } else if (isAutomated === false) {
      qb.andWhere('b.isAutomated = :isAutomated', { isAutomated: false });
    }

    const [broadcasts, total] = await qb.getManyAndCount();

    return {
      broadcasts: broadcasts.map((b) => ({
        id: b.id,
        title: b.title,
        message: b.message,
        broadcastType: b.broadcastType ?? 'general_announcement',
        targetAudience: b.targetAudience,
        deliveryMethod: b.deliveryMethod,
        featuredProductIds: b.featuredProductIds,
        emailSent: b.emailSent,
        notificationsCreated: b.notificationsCreated,
        totalRecipients: b.totalRecipients ?? 0,
        status: b.status ?? 'done',
        isAutomated: b.isAutomated ?? false,
        createdAt: b.createdAt.toISOString(),
        createdBy: b.createdBy
          ? {
              id: b.createdBy.id,
              name: b.createdBy.name,
              email: b.createdBy.email ?? '',
            }
          : { id: '', name: 'System', email: '' },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Marketing contacts with a deliverable email, deduped by address.
   * Skips normalized emails already covered by registered-user recipients.
   */
  private async loadMarketingEmailRecipients(
    excludeNorm: Set<string>,
    audienceGender?: string | null,
  ): Promise<Array<{ email: string; name: string | null }>> {
    const gCanon = normalizeMarketingGenderInput(audienceGender);
    const hasGender = gCanon != null;

    const qb = this.marketingContactRepository
      .createQueryBuilder('c')
      .select(['c.email', 'c.name'])
      .where('c.email IS NOT NULL')
      .andWhere("TRIM(c.email) != ''")
      .andWhere('c.emailSuppressedAt IS NULL');

    if (hasGender) {
      qb.andWhere('c.gender IS NOT NULL')
        .andWhere("TRIM(c.gender) != ''")
        .andWhere(
          "LOWER(TRIM(c.gender)) = LOWER(TRIM(:gender))",
          { gender: gCanon },
        );
    }

    const rows = await qb.getMany();

    const out: Array<{ email: string; name: string | null }> = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const raw = r.email?.trim();
      if (!raw) continue;
      const em = raw.toLowerCase();
      if (excludeNorm.has(em) || seen.has(em)) continue;
      seen.add(em);
      out.push({ email: raw, name: r.name });
    }
    return out;
  }

  /**
   * Validate broadcast payload by broadcastType rules
   */
  private validateBroadcastPayload(dto: CreateBroadcastDto): void {
    const { broadcastType, targetAudience, featuredProductIds } = dto;

    if (broadcastType === 'promote_products_affiliates') {
      if (!(targetAudience.length === 1 && targetAudience[0] === 'affiliate')) {
        throw new BadRequestException(
          'For broadcast type "promote_products_affiliates", targetAudience must be exactly ["affiliate"].',
        );
      }
      if (!featuredProductIds?.length) {
        throw new BadRequestException(
          'For broadcast type "promote_products_affiliates", featuredProductIds is required (at least one product).',
        );
      }
    } else if (broadcastType === 'marketing_products_customers') {
      if (!(targetAudience.length === 1 && targetAudience[0] === 'customer')) {
        throw new BadRequestException(
          'For broadcast type "marketing_products_customers", targetAudience must be exactly ["customer"].',
        );
      }
    }
    if (targetAudience.includes('marketing_audience')) {
      if (broadcastType !== 'general_announcement') {
        throw new BadRequestException(
          'Audience list (marketing_audience) is only available for general announcements.',
        );
      }
    }
    // general_announcement: any combination allowed (including marketing_audience)
  }

  // ─── In-memory progress tracker ────────────────────────────────────────────
  // Keyed by broadcast ID. Removed once the job finishes and DB is updated.
  private readonly broadcastJobs = new Map<
    string,
    {
      emailSent: number;
      notificationsCreated: number;
      emailFailed: number;
      totalRecipients: number;
      status: 'processing' | 'done' | 'failed';
    }
  >();

  /**
   * Start a broadcast job: saves the record immediately and processes
   * recipients in the background so the HTTP request returns at once.
   */
  async broadcast(
    dto: CreateBroadcastDto,
    createdById: string,
  ): Promise<{
    broadcastId: string;
    status: string;
    totalRecipients: number;
    message: string;
  }> {
    this.validateBroadcastPayload(dto);

    const roleTargets = dto.targetAudience.filter(
      (t): t is UserRoleTargetAudienceType =>
        t === 'affiliate' || t === 'seller' || t === 'customer',
    );
    const includeMarketingAudience =
      dto.targetAudience.includes('marketing_audience');

    const audienceGender =
      dto.audienceGender?.trim() ? dto.audienceGender.trim() : undefined;

    const users = await this.getUserRecipientsByTypes(
      roleTargets,
      audienceGender,
    );
    const sendEmail =
      dto.deliveryMethod === 'email' || dto.deliveryMethod === 'both';

    const userEmailsNorm = new Set(
      users
        .map((u) => u.email?.trim().toLowerCase())
        .filter((e): e is string => !!e),
    );

    let marketingRows: Array<{ email: string; name: string | null }> = [];
    if (includeMarketingAudience && sendEmail) {
      marketingRows = await this.loadMarketingEmailRecipients(
        userEmailsNorm,
        audienceGender,
      );
    }

    type JobRecipient =
      | { kind: 'user'; user: User }
      | { kind: 'marketing'; email: string; name: string | null };

    const jobRecipients: JobRecipient[] = [
      ...users.map((user) => ({ kind: 'user' as const, user })),
      ...marketingRows.map((m) => ({
        kind: 'marketing' as const,
        email: m.email,
        name: m.name,
      })),
    ];

    if (jobRecipients.length === 0) {
      throw new BadRequestException(
        'No recipients match this audience and delivery method.',
      );
    }

    // Apply optional cap — slice before saving totalRecipients so the record reflects reality
    const limit = dto.recipientLimit && dto.recipientLimit > 0 ? dto.recipientLimit : null;
    const finalRecipients = limit ? jobRecipients.slice(0, limit) : jobRecipients;
    const totalRecipients = finalRecipients.length;

    // Save the record immediately so we have an ID to return
    const record = await this.broadcastRepository.save(
      this.broadcastRepository.create({
        title: dto.title,
        message: dto.message,
        broadcastType: dto.broadcastType,
        targetAudience: dto.targetAudience,
        deliveryMethod: dto.deliveryMethod,
        featuredProductIds: dto.featuredProductIds ?? null,
        emailSent: 0,
        notificationsCreated: 0,
        totalRecipients,
        isAutomated: false,
        status: 'processing',
        createdById,
      }),
    );

    // Register in-memory tracker
    this.broadcastJobs.set(record.id, {
      emailSent: 0,
      notificationsCreated: 0,
      emailFailed: 0,
      totalRecipients,
      status: 'processing',
    });

    // Fire-and-forget: runs after the HTTP response is sent
    this.runBroadcastJob(record.id, dto, finalRecipients).catch((err) => {
      this.logger.error(`Broadcast job ${record.id} crashed:`, err);
    });

    return {
      broadcastId: record.id,
      status: 'processing',
      totalRecipients,
      message: 'Broadcast started — sending in the background',
    };
  }

  /**
   * Return live progress for a broadcast job.
   * Reads from in-memory tracker while processing, falls back to DB when done.
   */
  async getProgress(id: string): Promise<{
    id: string;
    status: string;
    emailSent: number;
    notificationsCreated: number;
    emailFailed: number;
    totalRecipients: number;
  }> {
    const job = this.broadcastJobs.get(id);
    if (job) {
      return { id, ...job };
    }

    const record = await this.broadcastRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Broadcast not found');

    // If the DB still says 'processing' but the in-memory tracker is gone,
    // the server restarted mid-send — recover the row immediately.
    if (record.status === 'processing') {
      await this.broadcastRepository.update(id, { status: 'failed' });
      record.status = 'failed';
      this.logger.warn(
        `Broadcast ${id} was stuck in 'processing' — marked as failed (server restarted)`,
      );
    }

    return {
      id: record.id,
      status: record.status ?? 'done',
      emailSent: record.emailSent,
      notificationsCreated: record.notificationsCreated,
      emailFailed: 0,
      totalRecipients: record.totalRecipients,
    };
  }

  /**
   * Background worker: loops through recipients, sends email/notification,
   * updates the in-memory counter, and flushes to DB periodically.
   */
  private async runBroadcastJob(
    broadcastId: string,
    dto: CreateBroadcastDto,
    recipients: Array<
      | { kind: 'user'; user: User }
      | { kind: 'marketing'; email: string; name: string | null }
    >,
  ): Promise<void> {
    const job = this.broadcastJobs.get(broadcastId);
    if (!job) return;

    const sendNotification =
      dto.deliveryMethod === 'notification' || dto.deliveryMethod === 'both';
    const sendEmail =
      dto.deliveryMethod === 'email' || dto.deliveryMethod === 'both';

    let featuredProducts: Awaited<ReturnType<typeof this.getFeaturedProducts>> =
      [];
    if (dto.featuredProductIds?.length) {
      featuredProducts = await this.getFeaturedProducts(dto.featuredProductIds);
    }

    const firstProductLink =
      featuredProducts.length > 0
        ? this.buildProductUrl(featuredProducts[0].id, null)
        : null;

    const DB_FLUSH_EVERY = 25; // persist progress to DB every N recipients

    try {
      for (let i = 0; i < recipients.length; i++) {
        const rec = recipients[i];

        if (rec.kind === 'user') {
          const user = rec.user;

          if (sendNotification) {
            try {
              const metadata: Record<string, unknown> = {};
              if (dto.featuredProductIds?.length) {
                metadata.productIds = dto.featuredProductIds;
              }
              const notification = await this.notificationsService.create({
                userId: user.id,
                type: NotificationType.SYSTEM_ANNOUNCEMENT,
                title: dto.title,
                message: dto.message,
                metadata:
                  Object.keys(metadata).length > 0 ? metadata : undefined,
                link: firstProductLink ?? undefined,
              });
              job.notificationsCreated++;
              await this.notificationsGateway.sendNotificationToUser(
                user.id,
                notification,
              );
            } catch (err) {
              this.logger.warn(
                `Broadcast ${broadcastId}: notification failed for user ${user.id}:`,
                err,
              );
            }
          }

          if (sendEmail && user.email) {
            try {
              const useReferralCode =
                dto.broadcastType === 'promote_products_affiliates' &&
                user.userType === UserType.AFFILIATE;
              const referralCode = useReferralCode
                ? await this.getReferralCodeForAffiliate(user.id)
                : null;
              const productPayload =
                featuredProducts.length > 0
                  ? featuredProducts.map((p) => ({
                      id: p.id,
                      name: p.name,
                      price: p.price,
                      salePrice: p.salePrice,
                      imageUrl: p.imageUrl,
                      productUrl: this.buildProductUrl(p.id, referralCode),
                    }))
                  : undefined;
              await this.emailService.sendBroadcastAnnouncement(
                user.email,
                user.name || 'there',
                dto.title,
                dto.message,
                productPayload,
              );
              job.emailSent++;
            } catch (err) {
              job.emailFailed++;
              this.logger.warn(
                `Broadcast ${broadcastId}: email failed for ${user.email}:`,
                err,
              );
            }
          }
        } else {
          if (sendEmail && rec.email) {
            try {
              const productPayload =
                featuredProducts.length > 0
                  ? featuredProducts.map((p) => ({
                      id: p.id,
                      name: p.name,
                      price: p.price,
                      salePrice: p.salePrice,
                      imageUrl: p.imageUrl,
                      productUrl: this.buildProductUrl(p.id, null),
                    }))
                  : undefined;
              await this.emailService.sendBroadcastAnnouncement(
                rec.email,
                rec.name || 'there',
                dto.title,
                dto.message,
                productPayload,
              );
              job.emailSent++;
            } catch (err) {
              job.emailFailed++;
              this.logger.warn(
                `Broadcast ${broadcastId}: email failed for ${rec.email}:`,
                err,
              );
            }
          }
        }

        // Flush intermediate progress to DB periodically
        if ((i + 1) % DB_FLUSH_EVERY === 0) {
          await this.broadcastRepository.update(broadcastId, {
            emailSent: job.emailSent,
            notificationsCreated: job.notificationsCreated,
          });
        }
      }

      // Mark done
      job.status = 'done';
      await this.broadcastRepository.update(broadcastId, {
        emailSent: job.emailSent,
        notificationsCreated: job.notificationsCreated,
        status: 'done',
      });

      this.logger.log(
        `Broadcast ${broadcastId} done: ${job.emailSent} emails sent, ${job.notificationsCreated} notifications created, ${job.emailFailed} failed`,
      );
    } catch (err) {
      job.status = 'failed';
      await this.broadcastRepository
        .update(broadcastId, {
          emailSent: job.emailSent,
          notificationsCreated: job.notificationsCreated,
          status: 'failed',
        })
        .catch(() => {});
      throw err;
    } finally {
      // Clean up in-memory tracker after a short delay so the last poll
      // that reads "done" still finds the entry
      setTimeout(() => {
        this.broadcastJobs.delete(broadcastId);
      }, 30_000);
    }
  }
}
