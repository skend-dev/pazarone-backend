import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  TargetAudienceType,
} from './dto/create-broadcast.dto';
import { Broadcast } from './entities/broadcast.entity';

const TARGET_TO_USER_TYPE: Record<TargetAudienceType, UserType> = {
  affiliate: UserType.AFFILIATE,
  seller: UserType.SELLER,
  customer: UserType.CUSTOMER,
};

@Injectable()
export class AdminBroadcastService {
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
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://pazarone.co';
  }

  /**
   * Resolve recipients by target audience (userType)
   */
  async getRecipients(targetAudience: TargetAudienceType[]): Promise<User[]> {
    const userTypes = targetAudience.map((t) => TARGET_TO_USER_TYPE[t]);
    return this.usersRepository.find({
      where: { userType: In(userTypes) },
      select: ['id', 'email', 'name', 'userType'],
    });
  }

  /**
   * Get audience counts for affiliates, sellers, customers (excludes admins)
   */
  async getAudienceCounts(): Promise<{
    affiliates: number;
    sellers: number;
    customers: number;
  }> {
    const [affiliates, sellers, customers] = await Promise.all([
      this.usersRepository.count({ where: { userType: UserType.AFFILIATE } }),
      this.usersRepository.count({ where: { userType: UserType.SELLER } }),
      this.usersRepository.count({ where: { userType: UserType.CUSTOMER } }),
    ]);
    return { affiliates, sellers, customers };
  }

  /**
   * Fetch featured products for broadcast (id, name, price, salePrice, images)
   */
  async getFeaturedProducts(
    productIds: string[],
  ): Promise<
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
      const salePrice =
        p.salePrice != null ? Number(p.salePrice) : null;
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
        const parsed = JSON.parse(images);
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
  private async getReferralCodeForAffiliate(affiliateId: string): Promise<string | null> {
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
    pagination: { page: number; limit: number; total: number; totalPages: number };
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
   * Validate broadcast payload by broadcastType rules
   */
  private validateBroadcastPayload(dto: CreateBroadcastDto): void {
    const { broadcastType, targetAudience, featuredProductIds } = dto;

    if (broadcastType === 'promote_products_affiliates') {
      if (
        !(
          targetAudience.length === 1 && targetAudience[0] === 'affiliate'
        )
      ) {
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
      if (
        !(
          targetAudience.length === 1 && targetAudience[0] === 'customer'
        )
      ) {
        throw new BadRequestException(
          'For broadcast type "marketing_products_customers", targetAudience must be exactly ["customer"].',
        );
      }
    }
    // general_announcement: any combination allowed
  }

  /**
   * Send broadcast: resolve recipients, create notifications, send emails, persist record
   */
  async broadcast(
    dto: CreateBroadcastDto,
    createdById: string,
  ): Promise<{
    success: boolean;
    emailSent: number;
    notificationsCreated: number;
    message: string;
  }> {
    this.validateBroadcastPayload(dto);

    const recipients = await this.getRecipients(dto.targetAudience);
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

    let notificationsCreated = 0;
    let emailSent = 0;

    for (const user of recipients) {
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
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            link: firstProductLink ?? undefined,
          });
          notificationsCreated++;
          await this.notificationsGateway.sendNotificationToUser(
            user.id,
            notification,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to create/send notification for user ${user.id}:`,
            err,
          );
        }
      }

      if (sendEmail && user.email) {
        try {
          // Only add referral code for promote_products_affiliates type; others use standard links
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
          emailSent++;
        } catch (err) {
          this.logger.warn(
            `Failed to send broadcast email to ${user.email}:`,
            err,
          );
        }
      }
    }

    // Persist broadcast record for history and duplicate support
    await this.broadcastRepository.save(
      this.broadcastRepository.create({
        title: dto.title,
        message: dto.message,
        broadcastType: dto.broadcastType,
        targetAudience: dto.targetAudience,
        deliveryMethod: dto.deliveryMethod,
        featuredProductIds: dto.featuredProductIds ?? null,
        emailSent,
        notificationsCreated,
        isAutomated: false,
        createdById,
      }),
    );

    return {
      success: true,
      emailSent,
      notificationsCreated,
      message: 'Broadcast sent successfully',
    };
  }
}
