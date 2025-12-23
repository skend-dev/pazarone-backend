import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Product, ProductStatus } from '../products/entities/product.entity';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { RecentOrderDto } from './dto/recent-order.dto';
import { SellerSettingsService } from './seller-settings.service';

@Injectable()
export class SellerDashboardService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private sellerSettingsService: SellerSettingsService,
  ) {}

  async getStats(sellerId: string): Promise<DashboardStatsDto> {
    const now = new Date();
    const lastPeriod = new Date(now);
    lastPeriod.setMonth(lastPeriod.getMonth() - 1);

    // Current period stats - use delivered orders for revenue calculation
    const [currentOrders, currentRevenue] = await Promise.all([
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.sellerId = :sellerId', { sellerId })
        .andWhere('order.status != :cancelled', {
          cancelled: OrderStatus.CANCELLED,
        })
        .getCount(),
      this.ordersRepository
        .createQueryBuilder('order')
        .select('SUM(order.totalAmount)', 'total')
        .where('order.sellerId = :sellerId', { sellerId })
        .andWhere('order.status = :delivered', {
          delivered: OrderStatus.DELIVERED,
        })
        .getRawOne(),
    ]);

    // Last period stats - use delivered orders for revenue calculation
    const [lastPeriodOrders, lastPeriodRevenue] = await Promise.all([
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.sellerId = :sellerId', { sellerId })
        .andWhere('order.createdAt < :lastPeriod', { lastPeriod })
        .andWhere('order.status != :cancelled', {
          cancelled: OrderStatus.CANCELLED,
        })
        .getCount(),
      this.ordersRepository
        .createQueryBuilder('order')
        .select('SUM(order.totalAmount)', 'total')
        .where('order.sellerId = :sellerId', { sellerId })
        .andWhere('order.createdAt < :lastPeriod', { lastPeriod })
        .andWhere('order.status = :delivered', {
          delivered: OrderStatus.DELIVERED,
        })
        .getRawOne(),
    ]);

    const totalRevenue = parseFloat(currentRevenue?.total || '0');
    const lastRevenue = parseFloat(lastPeriodRevenue?.total || '0');
    const revenueChange =
      lastRevenue > 0 ? ((totalRevenue - lastRevenue) / lastRevenue) * 100 : 0;
    const ordersChange =
      lastPeriodOrders > 0
        ? ((currentOrders - lastPeriodOrders) / lastPeriodOrders) * 100
        : 0;

    const activeProducts = await this.productsRepository.count({
      where: {
        sellerId,
        status: ProductStatus.ACTIVE,
      },
    });

    // Calculate average response time (mock for now - would need order response tracking)
    const avgResponseTime = '2h 15m';

    // Count pending reviews (mock for now - would need review system)
    const pendingReview = 1;

    // Calculate net revenue (total revenue - 7% platform fee - affiliate commissions)
    // Use current period for calculation (all orders, not just last month)
    const ordersWithItems = await this.ordersRepository.find({
      where: {
        sellerId,
        status: OrderStatus.DELIVERED,
      },
      relations: ['items', 'items.product'],
    });

    let totalAffiliateCommission = 0;
    ordersWithItems.forEach((order) => {
      order.items.forEach((item) => {
        const itemTotal = parseFloat(item.price.toString()) * item.quantity;
        const affiliateCommissionPercent =
          item.product?.affiliateCommission || 0;
        const itemAffiliateCommission =
          (itemTotal * affiliateCommissionPercent) / 100;
        totalAffiliateCommission += itemAffiliateCommission;
      });
    });

    // Get seller-specific platform fee or default
    const platformFeePercent =
      await this.sellerSettingsService.getPlatformFeePercent(sellerId);
    const platformFee = (totalRevenue * platformFeePercent) / 100;
    const netRevenue = totalRevenue - platformFee - totalAffiliateCommission;

    return {
      totalRevenue,
      netRevenue: Math.round(netRevenue * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      affiliateCommission: Math.round(totalAffiliateCommission * 100) / 100,
      totalOrders: currentOrders,
      activeProducts,
      avgResponseTime,
      revenueChange: Math.round(revenueChange * 100) / 100,
      ordersChange: Math.round(ordersChange * 100) / 100,
      pendingReview,
    };
  }

  async getRecentOrders(
    sellerId: string,
    limit: number = 10,
  ): Promise<RecentOrderDto[]> {
    const orders = await this.ordersRepository.find({
      where: { sellerId },
      relations: ['customer', 'items'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return orders.map((order) => {
      const firstItem = order.items[0];
      const now = new Date();
      const orderDate = order.createdAt;
      const diffMs = now.getTime() - orderDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      let relativeDate = '';
      if (diffHours < 1) {
        relativeDate = 'Just now';
      } else if (diffHours < 24) {
        relativeDate = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else {
        relativeDate = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      }

      return {
        id: order.id,
        customerName: order.customer.name,
        productName: firstItem?.productName || 'N/A',
        amount: parseFloat(order.totalAmount.toString()),
        status: order.status,
        date: order.createdAt,
        relativeDate,
      };
    });
  }
}
