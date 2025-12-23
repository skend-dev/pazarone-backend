import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { AffiliateReferral } from './entities/affiliate-referral.entity';
import { AffiliateCommission, CommissionStatus } from './entities/affiliate-commission.entity';
import { AffiliateWithdrawal, WithdrawalStatus } from './entities/affiliate-withdrawal.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { PlatformSettingsService } from '../platform/platform-settings.service';

@Injectable()
export class AffiliateService {
  constructor(
    @InjectRepository(AffiliateReferral)
    private affiliateReferralRepository: Repository<AffiliateReferral>,
    @InjectRepository(AffiliateCommission)
    private affiliateCommissionRepository: Repository<AffiliateCommission>,
    @InjectRepository(AffiliateWithdrawal)
    private affiliateWithdrawalRepository: Repository<AffiliateWithdrawal>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private platformSettingsService: PlatformSettingsService,
  ) {}

  // Generate unique referral code
  private generateReferralCode(affiliateId: string): string {
    const prefix = 'AFF-';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}-${random}`;
  }

  // Get or create referral code for affiliate
  async getOrCreateReferralCode(affiliateId: string): Promise<string> {
    // Verify user is an affiliate
    const user = await this.usersRepository.findOne({
      where: { id: affiliateId },
    });

    if (!user) {
      throw new NotFoundException('Affiliate not found');
    }

    if (user.userType !== UserType.AFFILIATE) {
      throw new BadRequestException('User is not an affiliate');
    }

    // Check if referral code already exists
    let referral = await this.affiliateReferralRepository.findOne({
      where: { affiliateId, isActive: true },
    });

    if (!referral) {
      // Generate unique referral code
      let referralCode: string;
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        referralCode = this.generateReferralCode(affiliateId);
        const existing = await this.affiliateReferralRepository.findOne({
          where: { referralCode },
        });

        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new Error('Failed to generate unique referral code');
      }

      referral = this.affiliateReferralRepository.create({
        affiliateId,
        referralCode: referralCode!,
        isActive: true,
      });

      referral = await this.affiliateReferralRepository.save(referral);
    }

    return referral.referralCode;
  }

  // Get affiliate from referral code
  async getAffiliateByReferralCode(referralCode: string): Promise<User | null> {
    const referral = await this.affiliateReferralRepository.findOne({
      where: { referralCode, isActive: true },
      relations: ['affiliate'],
    });

    return referral?.affiliate || null;
  }

  // Track referral click (increment click count)
  async trackReferralClick(referralCode: string): Promise<void> {
    const referral = await this.affiliateReferralRepository.findOne({
      where: { referralCode, isActive: true },
    });

    if (referral) {
      referral.totalClicks += 1;
      await this.affiliateReferralRepository.save(referral);
    }
  }

  // Create commission records for an order
  async createCommissionsForOrder(
    orderId: string,
    affiliateId: string,
  ): Promise<void> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Create commission for each item with affiliate commission
    for (const item of order.items) {
      if (!item.product) continue;

      const commissionPercent = item.product.affiliateCommission || 0;
      if (commissionPercent <= 0) continue; // Skip if no commission

      const itemTotal = parseFloat(item.price.toString()) * item.quantity;
      const commissionAmount = (itemTotal * commissionPercent) / 100;

      const commission = this.affiliateCommissionRepository.create({
        affiliateId,
        orderId: order.id,
        productId: item.productId,
        orderItemAmount: itemTotal,
        commissionPercent,
        commissionAmount,
        quantity: item.quantity,
        status: CommissionStatus.PENDING,
      });

      await this.affiliateCommissionRepository.save(commission);
    }

    // Update referral stats
    if (order.referralCode) {
      const referral = await this.affiliateReferralRepository.findOne({
        where: { referralCode: order.referralCode },
      });

      if (referral) {
        referral.totalOrders += 1;
        await this.affiliateReferralRepository.save(referral);
      }
    }
  }

  // Update commission status when order status changes
  async updateCommissionStatus(
    orderId: string,
    orderStatus: OrderStatus,
  ): Promise<void> {
    const commissions = await this.affiliateCommissionRepository.find({
      where: { orderId },
    });

    for (const commission of commissions) {
      if (orderStatus === OrderStatus.DELIVERED) {
        commission.status = CommissionStatus.APPROVED;
      } else if (
        orderStatus === OrderStatus.CANCELLED ||
        orderStatus === OrderStatus.RETURNED
      ) {
        commission.status = CommissionStatus.CANCELLED;
      }
      // Keep PENDING for other statuses
      await this.affiliateCommissionRepository.save(commission);
    }
  }

  // Get minimum withdrawal threshold (from platform settings)
  async getMinimumWithdrawalThreshold(): Promise<number> {
    return await this.platformSettingsService.getMinimumWithdrawalThreshold();
  }

  // Get available balance (approved earnings minus pending/approved withdrawals)
  async getAvailableBalance(affiliateId: string): Promise<number> {
    // Get total approved earnings
    const approvedEarningsResult = await this.affiliateCommissionRepository
      .createQueryBuilder('commission')
      .select('SUM(commission.commissionAmount)', 'total')
      .where('commission.affiliateId = :affiliateId', { affiliateId })
      .andWhere('commission.status = :status', {
        status: CommissionStatus.APPROVED,
      })
      .getRawOne();

    const approvedEarnings = parseFloat(approvedEarningsResult?.total || '0');

    // Get total pending/approved withdrawals
    const pendingWithdrawals = await this.affiliateWithdrawalRepository.find({
      where: {
        affiliateId,
        status: In([WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED]),
      },
    });

    const totalPendingWithdrawals = pendingWithdrawals.reduce(
      (sum, w) => sum + parseFloat(w.amount.toString()),
      0,
    );

    // Available balance = approved earnings - pending/approved withdrawals
    return Math.max(0, approvedEarnings - totalPendingWithdrawals);
  }

  // Get affiliate dashboard stats
  async getDashboardStats(affiliateId: string) {
    const referral = await this.affiliateReferralRepository.findOne({
      where: { affiliateId, isActive: true },
    });

    if (!referral) {
      throw new NotFoundException('Affiliate referral not found');
    }

    // Get commission statistics
    const [
      pendingCommissions,
      approvedCommissions,
      paidCommissions,
      totalEarnings,
      availableBalance,
    ] = await Promise.all([
      this.affiliateCommissionRepository.find({
        where: { affiliateId, status: CommissionStatus.PENDING },
      }),
      this.affiliateCommissionRepository.find({
        where: { affiliateId, status: CommissionStatus.APPROVED },
      }),
      this.affiliateCommissionRepository.find({
        where: { affiliateId, status: CommissionStatus.PAID },
      }),
      this.affiliateCommissionRepository
        .createQueryBuilder('commission')
        .select('SUM(commission.commissionAmount)', 'total')
        .where('commission.affiliateId = :affiliateId', { affiliateId })
        .andWhere('commission.status IN (:...statuses)', {
          statuses: [CommissionStatus.APPROVED, CommissionStatus.PAID],
        })
        .getRawOne(),
      this.getAvailableBalance(affiliateId),
    ]);

    const pendingAmount = pendingCommissions.reduce(
      (sum, c) => sum + parseFloat(c.commissionAmount.toString()),
      0,
    );
    const approvedAmount = approvedCommissions.reduce(
      (sum, c) => sum + parseFloat(c.commissionAmount.toString()),
      0,
    );
    const paidAmount = paidCommissions.reduce(
      (sum, c) => sum + parseFloat(c.commissionAmount.toString()),
      0,
    );

    const minimumWithdrawal = await this.getMinimumWithdrawalThreshold();

    return {
      referralCode: referral.referralCode,
      referralLink: this.getReferralLink(referral.referralCode),
      totalClicks: referral.totalClicks,
      totalOrders: referral.totalOrders,
      pendingEarnings: Math.round(pendingAmount * 100) / 100,
      approvedEarnings: Math.round(approvedAmount * 100) / 100,
      paidEarnings: Math.round(paidAmount * 100) / 100,
      totalEarnings: Math.round(parseFloat(totalEarnings?.total || '0') * 100) / 100,
      availableBalance: Math.round(availableBalance * 100) / 100,
      minimumWithdrawal: minimumWithdrawal,
      canWithdraw: availableBalance >= minimumWithdrawal,
      pendingCount: pendingCommissions.length,
      approvedCount: approvedCommissions.length,
      paidCount: paidCommissions.length,
    };
  }

  // Get referral link
  private getReferralLink(referralCode: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}?ref=${referralCode}`;
  }

  // Get commissions with pagination
  async getCommissions(
    affiliateId: string,
    page: number = 1,
    limit: number = 20,
    status?: CommissionStatus,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.affiliateCommissionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.order', 'order')
      .leftJoinAndSelect('commission.product', 'product')
      .where('commission.affiliateId = :affiliateId', { affiliateId })
      .orderBy('commission.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('commission.status = :status', { status });
    }

    const [commissions, total] = await queryBuilder.getManyAndCount();

    return {
      commissions: commissions.map((c) => ({
        id: c.id,
        orderNumber: c.order.orderNumber,
        productName: c.product?.name || 'Unknown Product',
        orderItemAmount: parseFloat(c.orderItemAmount.toString()),
        commissionPercent: parseFloat(c.commissionPercent.toString()),
        commissionAmount: parseFloat(c.commissionAmount.toString()),
        quantity: c.quantity,
        status: c.status,
        createdAt: c.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get earnings by period
  async getEarningsByPeriod(
    affiliateId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const commissions = await this.affiliateCommissionRepository.find({
      where: {
        affiliateId,
        createdAt: Between(startDate, endDate),
        status: CommissionStatus.APPROVED,
      },
      relations: ['order'],
    });

    const earningsByDate = new Map<string, number>();

    commissions.forEach((commission) => {
      const dateKey = commission.createdAt.toISOString().split('T')[0];
      const existing = earningsByDate.get(dateKey) || 0;
      earningsByDate.set(
        dateKey,
        existing + parseFloat(commission.commissionAmount.toString()),
      );
    });

    return Array.from(earningsByDate.entries()).map(([date, earnings]) => ({
      date,
      earnings: Math.round(earnings * 100) / 100,
    }));
  }

  // Request withdrawal
  async requestWithdrawal(
    affiliateId: string,
    amount: number,
    paymentMethod?: string,
    paymentDetails?: string,
  ) {
    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than 0');
    }

    // Check minimum withdrawal threshold
    const minimumWithdrawal = await this.getMinimumWithdrawalThreshold();
    if (amount < minimumWithdrawal) {
      throw new BadRequestException(
        `Minimum withdrawal amount is ${minimumWithdrawal} den. You requested ${amount} den.`,
      );
    }

    // Get available balance
    const availableBalance = await this.getAvailableBalance(affiliateId);
    if (amount > availableBalance) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${availableBalance} den, Requested: ${amount} den`,
      );
    }

    // Create withdrawal request
    const withdrawal = this.affiliateWithdrawalRepository.create({
      affiliateId: affiliateId,
      amount: amount,
      status: WithdrawalStatus.PENDING,
      paymentMethod: paymentMethod || undefined,
      paymentDetails: paymentDetails || undefined,
    });

    return await this.affiliateWithdrawalRepository.save(withdrawal);
  }

  // Get withdrawal history
  async getWithdrawals(
    affiliateId: string,
    page: number = 1,
    limit: number = 20,
    status?: WithdrawalStatus,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.affiliateWithdrawalRepository
      .createQueryBuilder('withdrawal')
      .where('withdrawal.affiliateId = :affiliateId', { affiliateId })
      .orderBy('withdrawal.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('withdrawal.status = :status', { status });
    }

    const [withdrawals, total] = await queryBuilder.getManyAndCount();

    return {
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: parseFloat(w.amount.toString()),
        status: w.status,
        paymentMethod: w.paymentMethod,
        notes: w.notes,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

