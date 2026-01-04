import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import {
  AnalyticsQueryDto,
  AnalyticsPeriod,
  TopProductsQueryDto,
} from './dto/analytics-query.dto';
import { SellerSettingsService } from './seller-settings.service';

@Injectable()
export class SellerAnalyticsService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private sellerSettingsService: SellerSettingsService,
  ) {}

  private getDateRange(
    period: AnalyticsPeriod,
    startDate?: string,
    endDate?: string,
  ) {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (period === AnalyticsPeriod.CUSTOM && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      start = new Date(now);
      if (period === AnalyticsPeriod.WEEK) {
        start.setDate(start.getDate() - 7);
      } else if (period === AnalyticsPeriod.MONTH) {
        start.setMonth(start.getMonth() - 1);
      } else if (period === AnalyticsPeriod.YEAR) {
        start.setFullYear(start.getFullYear() - 1);
      }
    }

    return { start, end };
  }

  async getOverview(sellerId: string, query: AnalyticsQueryDto) {
    const { start, end } = this.getDateRange(
      query.period || AnalyticsPeriod.MONTH,
      query.startDate,
      query.endDate,
    );

    const previousStart = new Date(start);
    const previousEnd = new Date(start);
    const diff = end.getTime() - start.getTime();
    previousStart.setTime(previousStart.getTime() - diff);
    previousEnd.setTime(previousEnd.getTime() - diff);

    // Current period
    const [currentOrders, currentRevenue] = await Promise.all([
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.sellerId = :sellerId', { sellerId })
        .andWhere('order.createdAt BETWEEN :start AND :end', { start, end })
        .andWhere('order.status != :cancelled', {
          cancelled: OrderStatus.CANCELLED,
        })
        .getCount(),
      this.ordersRepository
        .createQueryBuilder('order')
        .select('SUM(order.totalAmount)', 'total')
        .where('order.sellerId = :sellerId', { sellerId })
        .andWhere('order.createdAt BETWEEN :start AND :end', { start, end })
        .andWhere('order.status != :cancelled', {
          cancelled: OrderStatus.CANCELLED,
        })
        .getRawOne(),
    ]);

    // Previous period
    const [previousOrders, previousRevenue] = await Promise.all([
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.sellerId = :sellerId', { sellerId })
        .andWhere('order.createdAt BETWEEN :start AND :end', {
          start: previousStart,
          end: previousEnd,
        })
        .andWhere('order.status != :cancelled', {
          cancelled: OrderStatus.CANCELLED,
        })
        .getCount(),
      this.ordersRepository
        .createQueryBuilder('order')
        .select('SUM(order.totalAmount)', 'total')
        .where('order.sellerId = :sellerId', { sellerId })
        .andWhere('order.createdAt BETWEEN :start AND :end', {
          start: previousStart,
          end: previousEnd,
        })
        .andWhere('order.status != :cancelled', {
          cancelled: OrderStatus.CANCELLED,
        })
        .getRawOne(),
    ]);

    const totalRevenue = parseFloat(currentRevenue?.total || '0');
    const totalOrders = currentOrders;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = 3.8; // Mock - would need visitor tracking

    const prevRevenue = parseFloat(previousRevenue?.total || '0');
    const prevOrders = previousOrders;
    const prevAvgOrderValue = prevOrders > 0 ? prevRevenue / prevOrders : 0;

    const revenueChange =
      prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange =
      prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;
    const avgOrderValueChange =
      prevAvgOrderValue > 0
        ? ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100
        : 0;

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      conversionRate,
      revenueChange: Math.round(revenueChange * 100) / 100,
      ordersChange: Math.round(ordersChange * 100) / 100,
      avgOrderValueChange: Math.round(avgOrderValueChange * 100) / 100,
      conversionRateChange: -2, // Mock
    };
  }

  async getSalesTrend(sellerId: string, query: AnalyticsQueryDto) {
    const { start, end } = this.getDateRange(
      query.period || AnalyticsPeriod.MONTH,
      query.startDate,
      query.endDate,
    );

    const orders = await this.ordersRepository.find({
      where: {
        sellerId,
        createdAt: Between(start, end),
        status: OrderStatus.DELIVERED,
      },
      relations: ['items'],
    });

    // Group by date
    const dateMap = new Map<
      string,
      { sales: number; revenue: number; orders: number }
    >();

    orders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const existing = dateMap.get(dateKey) || {
        sales: 0,
        revenue: 0,
        orders: 0,
      };

      const orderSales = order.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      existing.sales += orderSales;
      existing.revenue += parseFloat(order.totalAmount.toString());
      existing.orders += 1;

      dateMap.set(dateKey, existing);
    });

    return Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      sales: data.sales,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }));
  }

  async getRevenueByCategory(sellerId: string, query: AnalyticsQueryDto) {
    const { start, end } = this.getDateRange(
      query.period || AnalyticsPeriod.MONTH,
      query.startDate,
      query.endDate,
    );

    const orders = await this.ordersRepository.find({
      where: {
        sellerId,
        createdAt: Between(start, end),
        status: OrderStatus.DELIVERED,
      },
      relations: ['items', 'items.product', 'items.product.category'],
    });

    const categoryMap = new Map<
      string,
      { name: string; revenue: number; orders: number }
    >();

    let totalRevenue = 0;

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const categoryName = item.product?.category?.name || 'Uncategorized';
        const existing = categoryMap.get(categoryName) || {
          name: categoryName,
          revenue: 0,
          orders: 0,
        };

        const itemRevenue = parseFloat(item.price.toString()) * item.quantity;
        existing.revenue += itemRevenue;
        totalRevenue += itemRevenue;

        if (!categoryMap.has(categoryName)) {
          existing.orders = 1;
        }

        categoryMap.set(categoryName, existing);
      });
    });

    return Array.from(categoryMap.values())
      .map((cat) => ({
        name: cat.name,
        revenue: Math.round(cat.revenue * 100) / 100,
        percentage:
          totalRevenue > 0 ? Math.round((cat.revenue / totalRevenue) * 100) : 0,
        orders: cat.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async getTopProducts(sellerId: string, query: TopProductsQueryDto) {
    const { start, end } = this.getDateRange(
      query.period || AnalyticsPeriod.MONTH,
      query.startDate,
      query.endDate,
    );

    const orders = await this.ordersRepository.find({
      where: {
        sellerId,
        createdAt: Between(start, end),
        status: OrderStatus.DELIVERED,
      },
      relations: ['items', 'items.product'],
    });

    const productMap = new Map<
      string,
      {
        id: string;
        name: string;
        sales: number;
        revenue: number;
        rating: number;
      }
    >();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const productId = item.productId;
        const existing = productMap.get(productId) || {
          id: productId,
          name: item.productName,
          sales: 0,
          revenue: 0,
          rating: item.product?.rating || 0,
        };

        existing.sales += item.quantity;
        existing.revenue += parseFloat(item.price.toString()) * item.quantity;
        productMap.set(productId, existing);
      });
    });

    const sortBy = query.sortBy || 'revenue';
    const sorted = Array.from(productMap.values()).sort((a, b) => {
      if (sortBy === 'sales') {
        return b.sales - a.sales;
      }
      return b.revenue - a.revenue;
    });

    return sorted.slice(0, query.limit || 10).map((p) => ({
      id: p.id,
      name: p.name,
      sales: p.sales,
      revenue: Math.round(p.revenue * 100) / 100,
      rating: p.rating || 0,
    }));
  }

  async getRevenueBreakdown(sellerId: string, query: AnalyticsQueryDto) {
    const { start, end } = this.getDateRange(
      query.period || AnalyticsPeriod.MONTH,
      query.startDate,
      query.endDate,
    );

    // Get all orders with items and products to calculate affiliate commissions
    const orders = await this.ordersRepository.find({
      where: {
        sellerId,
        createdAt: Between(start, end),
        status: OrderStatus.DELIVERED, // Only count delivered orders
      },
      relations: ['items', 'items.product'],
    });

    // Calculate total revenue - separate by currency
    let totalRevenueMKD = 0;
    let totalRevenueEUR = 0;
    let totalAffiliateCommissionMKD = 0;
    let totalAffiliateCommissionEUR = 0;

    orders.forEach((order) => {
      // Use totalAmountBase (seller's base currency) for consistent reporting
      const orderTotalBase = order.totalAmountBase
        ? parseFloat(order.totalAmountBase.toString())
        : parseFloat(order.totalAmount.toString()); // Fallback for legacy orders
      const sellerCurrency = order.sellerBaseCurrency || 'MKD';

      // Add order total to revenue in seller's base currency
      if (sellerCurrency === 'MKD') {
        totalRevenueMKD += orderTotalBase;
      } else if (sellerCurrency === 'EUR') {
        totalRevenueEUR += orderTotalBase;
      }

      // Calculate affiliate commission for each item using base prices
      order.items.forEach((item) => {
        const itemTotalBase =
          parseFloat(item.basePrice?.toString() || item.price.toString()) *
          item.quantity;
        const affiliateCommissionPercent =
          item.product?.affiliateCommission || 0;
        const itemAffiliateCommission =
          (itemTotalBase * affiliateCommissionPercent) / 100;

        if (sellerCurrency === 'MKD') {
          totalAffiliateCommissionMKD += itemAffiliateCommission;
        } else if (sellerCurrency === 'EUR') {
          totalAffiliateCommissionEUR += itemAffiliateCommission;
        }
      });
    });

    // Get seller-specific platform fee or default
    const platformFeePercent =
      await this.sellerSettingsService.getPlatformFeePercent(sellerId);

    // Calculate platform fees and net revenue per currency
    const platformFeeMKD = (totalRevenueMKD * platformFeePercent) / 100;
    const platformFeeEUR = (totalRevenueEUR * platformFeePercent) / 100;
    const netRevenueMKD =
      totalRevenueMKD - platformFeeMKD - totalAffiliateCommissionMKD;
    const netRevenueEUR =
      totalRevenueEUR - platformFeeEUR - totalAffiliateCommissionEUR;

    return {
      // MKD totals
      totalRevenueMKD: Math.round(totalRevenueMKD),
      platformFeeMKD: Math.round(platformFeeMKD),
      affiliateCommissionMKD: Math.round(totalAffiliateCommissionMKD),
      netRevenueMKD: Math.round(netRevenueMKD),
      // EUR totals
      totalRevenueEUR: Math.round(totalRevenueEUR * 100) / 100,
      platformFeeEUR: Math.round(platformFeeEUR * 100) / 100,
      affiliateCommissionEUR: Math.round(totalAffiliateCommissionEUR * 100) / 100,
      netRevenueEUR: Math.round(netRevenueEUR * 100) / 100,
      // Metadata
      platformFeePercent,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }
}
