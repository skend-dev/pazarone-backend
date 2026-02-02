import { Injectable, Logger } from '@nestjs/common';
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
   */
  async findAll(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    broadcasts: Array<{
      id: string;
      title: string;
      message: string;
      targetAudience: string[];
      deliveryMethod: string;
      featuredProductIds: string[] | null;
      emailSent: number;
      notificationsCreated: number;
      createdAt: string;
      createdBy: { id: string; name: string; email: string };
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;
    const [broadcasts, total] = await this.broadcastRepository.findAndCount({
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      broadcasts: broadcasts.map((b) => ({
        id: b.id,
        title: b.title,
        message: b.message,
        targetAudience: b.targetAudience,
        deliveryMethod: b.deliveryMethod,
        featuredProductIds: b.featuredProductIds,
        emailSent: b.emailSent,
        notificationsCreated: b.notificationsCreated,
        createdAt: b.createdAt.toISOString(),
        createdBy: b.createdBy
          ? {
              id: b.createdBy.id,
              name: b.createdBy.name,
              email: b.createdBy.email,
            }
          : { id: '', name: '', email: '' },
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
          const referralCode =
            user.userType === UserType.AFFILIATE
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
        targetAudience: dto.targetAudience,
        deliveryMethod: dto.deliveryMethod,
        featuredProductIds: dto.featuredProductIds ?? null,
        emailSent,
        notificationsCreated,
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
