import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Product, ProductStatus } from '../products/entities/product.entity';
import {
  AffiliateCommission,
  CommissionStatus,
} from '../affiliate/entities/affiliate-commission.entity';
import {
  AffiliateWithdrawal,
  WithdrawalStatus,
} from '../affiliate/entities/affiliate-withdrawal.entity';
import { PlatformSettingsService } from '../platform/platform-settings.service';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(AffiliateCommission)
    private affiliateCommissionRepository: Repository<AffiliateCommission>,
    @InjectRepository(AffiliateWithdrawal)
    private affiliateWithdrawalRepository: Repository<AffiliateWithdrawal>,
    private platformSettingsService: PlatformSettingsService,
  ) {}

  async getStats() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // User statistics
    const [totalUsers, sellers, affiliates, customers, admins] =
      await Promise.all([
        this.usersRepository.count(),
        this.usersRepository.count({ where: { userType: UserType.SELLER } }),
        this.usersRepository.count({ where: { userType: UserType.AFFILIATE } }),
        this.usersRepository.count({ where: { userType: UserType.CUSTOMER } }),
        this.usersRepository.count({ where: { userType: UserType.ADMIN } }),
      ]);

    // Order statistics
    const [totalOrders, currentMonthOrders, lastMonthOrders] =
      await Promise.all([
        this.ordersRepository.count(),
        this.ordersRepository
          .createQueryBuilder('order')
          .where('order.createdAt >= :date', { date: currentMonthStart })
          .getCount(),
        this.ordersRepository
          .createQueryBuilder('order')
          .where('order.createdAt >= :dateFrom', { dateFrom: lastMonthStart })
          .andWhere('order.createdAt <= :dateTo', { dateTo: lastMonthEnd })
          .getCount(),
      ]);

    const ordersChange =
      lastMonthOrders > 0
        ? ((currentMonthOrders - lastMonthOrders) / lastMonthOrders) * 100
        : 0;

    // Revenue statistics
    const [totalRevenue, currentMonthRevenue, lastMonthRevenue] =
      await Promise.all([
        this.ordersRepository
          .createQueryBuilder('order')
          .select('SUM(order.totalAmount)', 'total')
          .where('order.status = :status', { status: OrderStatus.DELIVERED })
          .getRawOne(),
        this.ordersRepository
          .createQueryBuilder('order')
          .select('SUM(order.totalAmount)', 'total')
          .where('order.status = :status', { status: OrderStatus.DELIVERED })
          .andWhere('order.createdAt >= :date', { date: currentMonthStart })
          .getRawOne(),
        this.ordersRepository
          .createQueryBuilder('order')
          .select('SUM(order.totalAmount)', 'total')
          .where('order.status = :status', { status: OrderStatus.DELIVERED })
          .andWhere('order.createdAt >= :dateFrom', {
            dateFrom: lastMonthStart,
          })
          .andWhere('order.createdAt <= :dateTo', { dateTo: lastMonthEnd })
          .getRawOne(),
      ]);

    const totalRevenueAmount = parseFloat(totalRevenue?.total || '0');
    const currentMonthRevenueAmount = parseFloat(
      currentMonthRevenue?.total || '0',
    );
    const lastMonthRevenueAmount = parseFloat(lastMonthRevenue?.total || '0');

    const revenueChange =
      lastMonthRevenueAmount > 0
        ? ((currentMonthRevenueAmount - lastMonthRevenueAmount) /
            lastMonthRevenueAmount) *
          100
        : 0;

    // Product statistics
    const [totalProducts, activeProducts] = await Promise.all([
      this.productsRepository.count(),
      this.productsRepository.count({
        where: { status: ProductStatus.ACTIVE },
      }),
    ]);

    // Platform fee calculation
    const platformFeePercent =
      await this.platformSettingsService.getPlatformFeePercent();
    const platformFee = (totalRevenueAmount * platformFeePercent) / 100;

    // Affiliate statistics
    const [totalAffiliateEarnings, pendingWithdrawals] = await Promise.all([
      this.affiliateCommissionRepository
        .createQueryBuilder('commission')
        .select('SUM(commission.commissionAmount)', 'total')
        .where('commission.status IN (:...statuses)', {
          statuses: [CommissionStatus.APPROVED, CommissionStatus.PAID],
        })
        .getRawOne(),
      this.affiliateWithdrawalRepository.find({
        where: { status: WithdrawalStatus.PENDING },
      }),
    ]);

    const totalAffiliateEarningsAmount = parseFloat(
      totalAffiliateEarnings?.total || '0',
    );
    const pendingWithdrawalsAmount = pendingWithdrawals.reduce(
      (sum, w) => sum + parseFloat(w.amount.toString()),
      0,
    );

    // Order status breakdown
    const [pending, processing, inTransit, delivered, cancelled] =
      await Promise.all([
        this.ordersRepository.count({ where: { status: OrderStatus.PENDING } }),
        this.ordersRepository.count({
          where: { status: OrderStatus.PROCESSING },
        }),
        this.ordersRepository.count({
          where: { status: OrderStatus.IN_TRANSIT },
        }),
        this.ordersRepository.count({
          where: { status: OrderStatus.DELIVERED },
        }),
        this.ordersRepository.count({
          where: { status: OrderStatus.CANCELLED },
        }),
      ]);

    return {
      users: {
        total: totalUsers,
        sellers,
        affiliates,
        customers,
        admins,
      },
      orders: {
        total: totalOrders,
        currentMonth: currentMonthOrders,
        lastMonth: lastMonthOrders,
        change: Math.round(ordersChange * 100) / 100,
        statusBreakdown: {
          pending,
          processing,
          inTransit,
          delivered,
          cancelled,
        },
      },
      revenue: {
        total: Math.round(totalRevenueAmount * 100) / 100,
        currentMonth: Math.round(currentMonthRevenueAmount * 100) / 100,
        lastMonth: Math.round(lastMonthRevenueAmount * 100) / 100,
        change: Math.round(revenueChange * 100) / 100,
        platformFee: Math.round(platformFee * 100) / 100,
        platformFeePercent,
      },
      products: {
        total: totalProducts,
        active: activeProducts,
        inactive: totalProducts - activeProducts,
      },
      affiliates: {
        totalEarnings: Math.round(totalAffiliateEarningsAmount * 100) / 100,
        pendingWithdrawals: Math.round(pendingWithdrawalsAmount * 100) / 100,
        pendingWithdrawalsCount: pendingWithdrawals.length,
      },
    };
  }
}
