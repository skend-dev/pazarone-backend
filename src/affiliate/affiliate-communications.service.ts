import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { Product, ProductStatus } from '../products/entities/product.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { AffiliateService } from './affiliate.service';
import { EmailService } from '../auth/services/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../notifications/entities/notification.entity';
import { AffiliateReferralClick } from './entities/affiliate-referral-click.entity';
import { AffiliateCommission, CommissionStatus } from './entities/affiliate-commission.entity';

interface ProductInfo {
  id: string;
  name: string;
  description: string;
  regularPrice: number | null;
  salePrice: number | null;
  affiliateCommission: number;
  images: string[] | null;
  imageUrl: string | null;
}

interface AffiliateStats {
  totalEarnings: number;
  availableBalance: number;
  totalClicks: number;
  totalOrders: number;
  referralCode: string;
  referralLink: string;
  thisWeekClicks?: number;
  thisWeekOrders?: number;
  thisWeekEarnings?: number;
}

@Injectable()
export class AffiliateCommunicationsService {
  private readonly logger = new Logger(AffiliateCommunicationsService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(AffiliateReferralClick)
    private affiliateReferralClickRepository: Repository<AffiliateReferralClick>,
    @InjectRepository(AffiliateCommission)
    private affiliateCommissionRepository: Repository<AffiliateCommission>,
    private affiliateService: AffiliateService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Get products currently on sale
   */
  async getProductsOnSale(limit: number = 15): Promise<ProductInfo[]> {
    const now = new Date();
    const products = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.salePrice IS NOT NULL')
      .andWhere(
        '(product.salePriceExpiresAt IS NULL OR product.salePriceExpiresAt > :now)',
        { now },
      )
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.approved = :approved', { approved: true })
      .orderBy('product.salePriceExpiresAt', 'ASC', 'NULLS LAST')
      .addOrderBy('product.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return this.formatProducts(products);
  }

  /**
   * Get top-selling products based on delivered orders
   */
  async getTopSellingProducts(limit: number = 10): Promise<ProductInfo[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topProducts = await this.orderItemRepository
      .createQueryBuilder('orderItem')
      .innerJoin('orderItem.order', 'order')
      .innerJoin('orderItem.product', 'product')
      .select('product.id', 'id')
      .addSelect('SUM(orderItem.quantity)', 'totalQuantity')
      .where('order.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere('order.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .andWhere('product.status = :productStatus', {
        productStatus: ProductStatus.ACTIVE,
      })
      .andWhere('product.approved = :approved', { approved: true })
      .groupBy('product.id')
      .orderBy('totalQuantity', 'DESC')
      .limit(limit)
      .getRawMany();

    if (topProducts.length === 0) {
      return [];
    }

    const productIds = topProducts.map((p) => p.id);
    const products = await this.productsRepository.find({
      where: { id: productIds as any },
    });

    // Sort products by the order from topProducts query
    const sortedProducts = productIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => p !== undefined);

    return this.formatProducts(sortedProducts);
  }

  /**
   * Get products with high affiliate commission rates
   */
  async getHighCommissionProducts(
    minCommission: number = 5,
    limit: number = 10,
  ): Promise<ProductInfo[]> {
    const products = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.affiliateCommission >= :minCommission', {
        minCommission,
      })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.approved = :approved', { approved: true })
      .orderBy('product.affiliateCommission', 'DESC')
      .addOrderBy('product.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return this.formatProducts(products);
  }

  /**
   * Format products for email display
   */
  private formatProducts(products: Product[]): ProductInfo[] {
    return products.map((product) => {
      let images: string[] = [];
      try {
        const productImages: any = product.images;
        
        if (Array.isArray(productImages)) {
          images = productImages;
        } else if (productImages !== null && productImages !== undefined) {
          // Handle case where images might be stored as JSON string (legacy or jsonb)
          // TypeORM jsonb columns can sometimes return as strings
          if (typeof productImages === 'string') {
            try {
              const parsed = JSON.parse(productImages);
              images = Array.isArray(parsed) ? parsed : [];
            } catch {
              // If JSON parsing fails, check if it's a single URL string
              if (productImages.startsWith('http')) {
                images = [productImages];
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to parse images for product ${product.id}:`,
          error,
        );
        images = [];
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description || '',
        regularPrice: product.regularPrice
          ? parseFloat(product.regularPrice.toString())
          : product.price
            ? parseFloat(product.price.toString())
            : null,
        salePrice: product.salePrice
          ? parseFloat(product.salePrice.toString())
          : null,
        affiliateCommission: parseFloat(
          (product.affiliateCommission || 0).toString(),
        ),
        images: images,
        imageUrl: images && images.length > 0 ? images[0] : null,
      };
    });
  }

  /**
   * Get affiliate stats including this week's performance
   */
  async getAffiliateStats(affiliateId: string): Promise<AffiliateStats> {
    // Ensure referral code exists, create if it doesn't
    let referralCode: string;
    try {
      referralCode = await this.affiliateService.getOrCreateReferralCode(
        affiliateId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get/create referral code for affiliate ${affiliateId}:`,
        error,
      );
      throw error;
    }

    // Get dashboard stats (this will throw if referral doesn't exist, but we just created it)
    let dashboardStats;
    try {
      dashboardStats = await this.affiliateService.getDashboardStats(
        affiliateId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get dashboard stats for affiliate ${affiliateId}:`,
        error,
      );
      // Fallback: create minimal stats
      const baseUrl = process.env.FRONTEND_URL || 'https://pazarone.co';
      dashboardStats = {
        referralCode,
        referralLink: `${baseUrl}?ref=${referralCode}`,
        totalClicks: 0,
        totalOrders: 0,
        totalEarnings: 0,
        availableBalance: 0,
      };
    }

    // Calculate this week's stats (starting from Monday)
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday = 0
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const [thisWeekClicks, thisWeekOrders, thisWeekCommissions] =
      await Promise.all([
        this.affiliateReferralClickRepository.count({
          where: {
            affiliateId,
            clickedAt: MoreThan(startOfWeek),
          },
        }),
        this.ordersRepository.count({
          where: {
            affiliateId,
            createdAt: MoreThan(startOfWeek),
            status: OrderStatus.DELIVERED,
          },
        }),
        this.affiliateCommissionRepository
          .createQueryBuilder('commission')
          .select('SUM(commission.commissionAmount)', 'total')
          .where('commission.affiliateId = :affiliateId', { affiliateId })
          .andWhere('commission.createdAt >= :startOfWeek', {
            startOfWeek,
          })
          .andWhere('commission.status IN (:...statuses)', {
            statuses: [CommissionStatus.APPROVED, CommissionStatus.PAID],
          })
          .getRawOne(),
      ]);

    return {
      totalEarnings: dashboardStats.totalEarnings,
      availableBalance: dashboardStats.availableBalance,
      totalClicks: dashboardStats.totalClicks,
      totalOrders: dashboardStats.totalOrders,
      referralCode: dashboardStats.referralCode,
      referralLink: dashboardStats.referralLink,
      thisWeekClicks: thisWeekClicks || 0,
      thisWeekOrders: thisWeekOrders || 0,
      thisWeekEarnings:
        Math.round(
          (parseFloat(thisWeekCommissions?.total || '0') || 0) * 100,
        ) / 100,
    };
  }

  /**
   * Determine if affiliate is active or inactive
   */
  async isAffiliateActive(affiliateId: string): Promise<boolean> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [hasRecentClicks, hasRecentOrders, hasEarnings] = await Promise.all([
      this.affiliateReferralClickRepository.count({
        where: {
          affiliateId,
          clickedAt: MoreThan(thirtyDaysAgo),
        },
      }),
      this.ordersRepository.count({
        where: {
          affiliateId,
          createdAt: MoreThan(thirtyDaysAgo),
        },
      }),
      this.affiliateCommissionRepository
        .createQueryBuilder('commission')
        .select('SUM(commission.commissionAmount)', 'total')
        .where('commission.affiliateId = :affiliateId', { affiliateId })
        .andWhere('commission.status IN (:...statuses)', {
          statuses: [CommissionStatus.APPROVED, CommissionStatus.PAID],
        })
        .getRawOne(),
    ]);

    const totalEarnings = parseFloat(hasEarnings?.total || '0');
    return (
      hasRecentClicks > 0 || hasRecentOrders > 0 || totalEarnings > 0
    );
  }

  /**
   * Generate motivational message based on affiliate performance
   */
  private getMotivationalMessage(
    stats: AffiliateStats,
    isActive: boolean,
  ): string {
    if (isActive) {
      if (stats.thisWeekEarnings && stats.thisWeekEarnings > 0) {
        return `Keep up the great work! You've earned ${stats.thisWeekEarnings.toFixed(2)} den this week.`;
      }
      if (stats.thisWeekClicks && stats.thisWeekClicks > 0) {
        return `Your referral link has ${stats.thisWeekClicks} clicks this week! Keep sharing to convert those clicks into earnings.`;
      }
      if (stats.totalEarnings > 0) {
        return `You're doing great! You've earned ${stats.totalEarnings.toFixed(2)} den total. Keep sharing to grow your earnings!`;
      }
      return `You're on the right track! Start sharing your unique referral link to start earning commissions.`;
    } else {
      return `Start earning today! Share your unique link and earn commissions on every sale. Your referral code: ${stats.referralCode}`;
    }
  }

  /**
   * Send weekly communications to all affiliates
   */
  async sendWeeklyCommunications(): Promise<void> {
    this.logger.log('Starting weekly affiliate communications...');

    // Get all active affiliates
    const affiliates = await this.usersRepository.find({
      where: { userType: UserType.AFFILIATE },
    });

    this.logger.log(`Found ${affiliates.length} affiliates to process`);

    // Get product data once for all affiliates
    const [productsOnSale, topProducts, highCommissionProducts] =
      await Promise.all([
        this.getProductsOnSale(15),
        this.getTopSellingProducts(10),
        this.getHighCommissionProducts(5, 10),
      ]);

    this.logger.log(
      `Found ${productsOnSale.length} products on sale, ${topProducts.length} top products, ${highCommissionProducts.length} high commission products`,
    );

    let successCount = 0;
    let failureCount = 0;

    // Process each affiliate
    for (const affiliate of affiliates) {
      try {
        // Skip affiliates without email
        if (!affiliate.email || !affiliate.email.trim()) {
          this.logger.warn(
            `Skipping affiliate ${affiliate.id} - no email address`,
          );
          failureCount++;
          continue;
        }

        await this.sendAffiliateCommunication(
          affiliate.id,
          affiliate.email,
          affiliate.name || 'Affiliate',
          productsOnSale,
          topProducts,
          highCommissionProducts,
        );
        successCount++;
      } catch (error) {
        this.logger.error(
          `Failed to send communication to affiliate ${affiliate.id} (${affiliate.email || 'no email'}):`,
          error,
        );
        failureCount++;
        // Continue processing other affiliates
      }
    }

    this.logger.log(
      `Weekly affiliate communications completed. Success: ${successCount}, Failures: ${failureCount}`,
    );
  }

  /**
   * Send communication to a single affiliate
   */
  async sendAffiliateCommunication(
    affiliateId: string,
    email: string,
    name: string,
    productsOnSale: ProductInfo[],
    topProducts: ProductInfo[],
    highCommissionProducts: ProductInfo[],
  ): Promise<void> {
    // Validate email exists
    if (!email || !email.trim()) {
      throw new Error(`Affiliate ${affiliateId} has no email address`);
    }

    // Get affiliate stats
    const stats = await this.getAffiliateStats(affiliateId);
    const isActive = await this.isAffiliateActive(affiliateId);
    const motivationalMessage = this.getMotivationalMessage(stats, isActive);

    // Send email
    await this.emailService.sendAffiliateWeeklyNewsletter(
      email,
      name,
      stats,
      productsOnSale,
      topProducts,
      highCommissionProducts,
      motivationalMessage,
    );

    // Create notification
    const productCount =
      productsOnSale.length + topProducts.length + highCommissionProducts.length;
    const notification = await this.notificationsService.create({
      userId: affiliateId,
      type: NotificationType.AFFILIATE_WEEKLY_UPDATE,
      title: 'Weekly Affiliate Update',
      message: `Check out ${productCount} products on sale this week! Your earnings: ${stats.totalEarnings.toFixed(2)} den.`,
      metadata: {
        productCount,
        totalEarnings: stats.totalEarnings,
        availableBalance: stats.availableBalance,
        referralCode: stats.referralCode,
      },
      link: '/affiliate/dashboard',
    });

    // Send WebSocket notification
    await this.notificationsGateway.sendNotificationToUser(
      affiliateId,
      notification,
    );

    this.logger.log(`Sent weekly communication to affiliate ${affiliateId}`);
  }
}
