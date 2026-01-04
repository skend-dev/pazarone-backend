import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { AffiliateReferral } from './entities/affiliate-referral.entity';
import { AffiliateReferralClick } from './entities/affiliate-referral-click.entity';
import {
  AffiliateCommission,
  CommissionStatus,
} from './entities/affiliate-commission.entity';
import {
  AffiliateWithdrawal,
  WithdrawalStatus,
} from './entities/affiliate-withdrawal.entity';
import { AffiliatePaymentMethod } from './entities/affiliate-payment-method.entity';
import { PaymentMethodOtp } from './entities/payment-method-otp.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { VerifyPaymentMethodOtpDto } from './dto/verify-payment-method-otp.dto';
import { EmailService } from '../auth/services/email.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectRepository(AffiliateReferral)
    private affiliateReferralRepository: Repository<AffiliateReferral>,
    @InjectRepository(AffiliateReferralClick)
    private affiliateReferralClickRepository: Repository<AffiliateReferralClick>,
    @InjectRepository(AffiliateCommission)
    private affiliateCommissionRepository: Repository<AffiliateCommission>,
    @InjectRepository(AffiliateWithdrawal)
    private affiliateWithdrawalRepository: Repository<AffiliateWithdrawal>,
    @InjectRepository(AffiliatePaymentMethod)
    private affiliatePaymentMethodRepository: Repository<AffiliatePaymentMethod>,
    @InjectRepository(PaymentMethodOtp)
    private paymentMethodOtpRepository: Repository<PaymentMethodOtp>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private platformSettingsService: PlatformSettingsService,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
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
  async trackReferralClick(
    referralCode: string,
    productId?: string | null,
  ): Promise<void> {
    const referral = await this.affiliateReferralRepository.findOne({
      where: { referralCode, isActive: true },
    });

    if (!referral) {
      this.logger.warn(`Referral code not found or inactive: ${referralCode}`);
      return;
    }

    // Validate productId format if provided (should be UUID)
    if (productId) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(productId)) {
        this.logger.warn(
          `Invalid productId format: ${productId} for referral code: ${referralCode}`,
        );
        // Continue with null productId instead of failing
        productId = null;
      }
    }

    // Increment total clicks in referral record
    referral.totalClicks += 1;
    await this.affiliateReferralRepository.save(referral);

    // Store individual click record with product information
    const click = this.affiliateReferralClickRepository.create({
      affiliateId: referral.affiliateId,
      referralCode: referralCode,
      productId: productId || null,
    });

    await this.affiliateReferralClickRepository.save(click);

    // Log for debugging
    if (productId) {
      this.logger.log(
        `✅ Tracked product-specific click: referralCode=${referralCode}, productId=${productId}, affiliateId=${referral.affiliateId}`,
      );
    } else {
      this.logger.log(
        `⚠️ Tracked general click (no productId): referralCode=${referralCode}, affiliateId=${referral.affiliateId}`,
      );
    }
  }

  // Get product-specific clicks for an affiliate
  async getProductClicks(affiliateId: string): Promise<
    Array<{
      productId: string;
      clicks: number;
    }>
  > {
    const productClicks = await this.affiliateReferralClickRepository
      .createQueryBuilder('click')
      .select('click.productId', 'productId')
      .addSelect('COUNT(*)', 'clicks')
      .where('click.affiliateId = :affiliateId', { affiliateId })
      .andWhere('click.productId IS NOT NULL')
      .groupBy('click.productId')
      .having('COUNT(*) > 0')
      .orderBy('clicks', 'DESC')
      .getRawMany();

    return productClicks.map((item) => ({
      productId: item.productId,
      clicks: parseInt(item.clicks, 10),
    }));
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

  // Get total amount of pending/approved withdrawals
  async getPendingWithdrawalsTotal(affiliateId: string): Promise<number> {
    const pendingWithdrawals = await this.affiliateWithdrawalRepository.find({
      where: {
        affiliateId,
        status: In([WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED]),
      },
    });

    return pendingWithdrawals.reduce(
      (sum, w) => sum + parseFloat(w.amount.toString()),
      0,
    );
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
    const totalPendingWithdrawals =
      await this.getPendingWithdrawalsTotal(affiliateId);

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
      pendingWithdrawalsTotal,
      hasWithdrawalThisMonth,
      nextWithdrawalDate,
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
      this.getPendingWithdrawalsTotal(affiliateId),
      this.hasWithdrawalThisMonth(affiliateId),
      this.getNextWithdrawalDate(affiliateId),
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

    // canWithdraw: must meet minimum threshold AND not have withdrawal this month
    const canWithdraw =
      availableBalance >= minimumWithdrawal && !hasWithdrawalThisMonth;

    return {
      referralCode: referral.referralCode,
      referralLink: this.getReferralLink(referral.referralCode),
      totalClicks: referral.totalClicks,
      totalOrders: referral.totalOrders,
      pendingEarnings: Math.round(pendingAmount * 100) / 100,
      approvedEarnings: Math.round(approvedAmount * 100) / 100,
      paidEarnings: Math.round(paidAmount * 100) / 100,
      totalEarnings:
        Math.round(parseFloat(totalEarnings?.total || '0') * 100) / 100,
      availableBalance: Math.round(availableBalance * 100) / 100,
      pendingWithdrawals: Math.round(pendingWithdrawalsTotal * 100) / 100, // Total amount in pending/approved withdrawals
      minimumWithdrawal: minimumWithdrawal,
      canWithdraw: canWithdraw,
      hasWithdrawalThisMonth: hasWithdrawalThisMonth, // NEW: Whether a withdrawal was already requested this month
      nextWithdrawalDate: nextWithdrawalDate, // NEW: Date when next withdrawal can be requested (null if can request now)
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

  // Check if affiliate has already made a withdrawal request in the current month
  async hasWithdrawalThisMonth(affiliateId: string): Promise<boolean> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Count any withdrawal status (PENDING, APPROVED, PAID, REJECTED)
    // Once a request is made, even if rejected, they can't request again this month
    const count = await this.affiliateWithdrawalRepository
      .createQueryBuilder('withdrawal')
      .where('withdrawal.affiliateId = :affiliateId', { affiliateId })
      .andWhere('withdrawal.createdAt >= :startOfMonth', {
        startOfMonth: startOfMonth.toISOString(),
      })
      .andWhere('withdrawal.createdAt <= :endOfMonth', {
        endOfMonth: endOfMonth.toISOString(),
      })
      .getCount();

    return count > 0;
  }

  // Get the date when the next withdrawal can be requested (first day of next month)
  async getNextWithdrawalDate(affiliateId: string): Promise<Date | null> {
    const hasWithdrawal = await this.hasWithdrawalThisMonth(affiliateId);

    if (!hasWithdrawal) {
      return null; // Can request now
    }

    // Return first day of next month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
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

    // Check monthly limit - only one withdrawal per month
    const hasWithdrawalThisMonth =
      await this.hasWithdrawalThisMonth(affiliateId);
    if (hasWithdrawalThisMonth) {
      const nextWithdrawalDate = await this.getNextWithdrawalDate(affiliateId);
      const nextDateStr = nextWithdrawalDate
        ? nextWithdrawalDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'next month';
      throw new BadRequestException(
        `You have already requested a withdrawal this month. You can request your next withdrawal on ${nextDateStr}.`,
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
  // IMPORTANT: This method only returns withdrawals for the specified affiliateId
  // Controllers must ensure they pass the authenticated user's ID to prevent unauthorized access
  async getWithdrawals(
    affiliateId: string,
    page: number = 1,
    limit: number = 20,
    status?: WithdrawalStatus,
  ) {
    // Validate affiliateId is provided
    if (!affiliateId || typeof affiliateId !== 'string') {
      throw new BadRequestException('Invalid affiliate ID');
    }

    const skip = (page - 1) * limit;

    // Explicitly filter by affiliateId - this ensures users can only see their own withdrawals
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

    // Safety check: ensure all returned withdrawals belong to the requested affiliate
    // This should never filter anything since the query already filters by affiliateId,
    // but it provides an extra layer of security
    const filteredWithdrawals = withdrawals.filter(
      (w) => w.affiliateId === affiliateId,
    );

    // If any withdrawals were filtered out (should never happen), log a warning
    if (filteredWithdrawals.length !== withdrawals.length) {
      this.logger.error(
        `SECURITY ALERT: Found ${withdrawals.length - filteredWithdrawals.length} withdrawals that don't belong to affiliate ${affiliateId}. This indicates a potential security issue.`,
      );
    }

    return {
      withdrawals: filteredWithdrawals.map((w) => ({
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
        total, // Total count across all pages for this affiliate (from query)
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get payment method for affiliate
  async getPaymentMethod(affiliateId: string) {
    const paymentMethod = await this.affiliatePaymentMethodRepository.findOne({
      where: { affiliateId },
    });

    if (!paymentMethod) {
      return null;
    }

    return {
      id: paymentMethod.id,
      bankName: paymentMethod.bankName,
      accountNumber: this.maskAccountNumber(paymentMethod.accountNumber),
      accountHolderName: paymentMethod.accountHolderName,
      iban: paymentMethod.iban,
      swiftCode: paymentMethod.swiftCode,
      bankAddress: paymentMethod.bankAddress,
      verified: paymentMethod.verified,
      verificationNotes: paymentMethod.verificationNotes,
      createdAt: paymentMethod.createdAt,
      updatedAt: paymentMethod.updatedAt,
    };
  }

  // Update or create payment method
  async updatePaymentMethod(
    affiliateId: string,
    updatePaymentMethodDto: UpdatePaymentMethodDto,
  ) {
    let paymentMethod = await this.affiliatePaymentMethodRepository.findOne({
      where: { affiliateId },
    });

    if (paymentMethod) {
      // Update existing payment method
      // Reset verification when payment method is updated
      paymentMethod.bankName = updatePaymentMethodDto.bankName;
      paymentMethod.accountNumber = updatePaymentMethodDto.accountNumber;
      paymentMethod.accountHolderName =
        updatePaymentMethodDto.accountHolderName;
      paymentMethod.iban = updatePaymentMethodDto.iban || null;
      paymentMethod.swiftCode = updatePaymentMethodDto.swiftCode || null;
      paymentMethod.bankAddress = updatePaymentMethodDto.bankAddress || null;
      paymentMethod.verified = false; // Reset verification when updated
      paymentMethod.verificationNotes = null;
    } else {
      // Create new payment method
      paymentMethod = this.affiliatePaymentMethodRepository.create({
        affiliateId,
        bankName: updatePaymentMethodDto.bankName,
        accountNumber: updatePaymentMethodDto.accountNumber,
        accountHolderName: updatePaymentMethodDto.accountHolderName,
        iban: updatePaymentMethodDto.iban || null,
        swiftCode: updatePaymentMethodDto.swiftCode || null,
        bankAddress: updatePaymentMethodDto.bankAddress || null,
        verified: false,
      });
    }

    const saved =
      await this.affiliatePaymentMethodRepository.save(paymentMethod);

    return {
      id: saved.id,
      bankName: saved.bankName,
      accountNumber: this.maskAccountNumber(saved.accountNumber),
      accountHolderName: saved.accountHolderName,
      iban: saved.iban,
      swiftCode: saved.swiftCode,
      bankAddress: saved.bankAddress,
      verified: saved.verified,
      verificationNotes: saved.verificationNotes,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  // Helper method to mask account number for display
  private maskAccountNumber(accountNumber: string): string {
    if (!accountNumber || accountNumber.length <= 4) {
      return accountNumber;
    }
    const last4 = accountNumber.slice(-4);
    const masked = '*'.repeat(accountNumber.length - 4);
    return `${masked}${last4}`;
  }

  /**
   * Generate a 6-digit OTP code
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP code to affiliate's email for payment method verification
   */
  async sendPaymentMethodOtp(affiliateId: string): Promise<void> {
    // Get affiliate user
    const user = await this.usersRepository.findOne({
      where: { id: affiliateId },
    });

    if (!user || !user.email) {
      throw new NotFoundException('Affiliate user or email not found');
    }

    // Check if payment method exists
    const paymentMethod = await this.affiliatePaymentMethodRepository.findOne({
      where: { affiliateId },
    });

    if (!paymentMethod) {
      throw new BadRequestException(
        'Payment method not found. Please add a payment method first.',
      );
    }

    // Invalidate any existing unverified OTPs for this affiliate
    await this.paymentMethodOtpRepository.update(
      {
        affiliateId,
        verified: false,
      },
      {
        verified: true, // Mark as used (invalidated)
      },
    );

    // Generate new OTP code
    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    // Create OTP record
    const otp = this.paymentMethodOtpRepository.create({
      affiliateId,
      code,
      expiresAt,
      verified: false,
    });

    await this.paymentMethodOtpRepository.save(otp);

    // Send email with OTP
    try {
      await this.emailService.sendPaymentMethodVerificationCode(
        user.email,
        code,
      );
      this.logger.log(
        `Payment method OTP sent to ${user.email} for affiliate ${affiliateId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send payment method OTP to ${user.email}:`,
        error,
      );
      throw new BadRequestException('Failed to send OTP email');
    }
  }

  /**
   * Verify OTP code to confirm user identity
   * Note: This only confirms the user owns the email, it does NOT verify the payment method.
   * Payment method verification is done separately by admin.
   */
  async verifyPaymentMethodOtp(
    affiliateId: string,
    verifyOtpDto: VerifyPaymentMethodOtpDto,
  ): Promise<{ success: boolean; message: string }> {
    // Find the most recent unverified OTP for this affiliate
    const otp = await this.paymentMethodOtpRepository.findOne({
      where: {
        affiliateId,
        verified: false,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!otp) {
      throw new BadRequestException(
        'No OTP code found. Please request a new OTP code.',
      );
    }

    // Check if OTP is expired
    if (new Date() > otp.expiresAt) {
      throw new BadRequestException(
        'OTP code has expired. Please request a new one.',
      );
    }

    // Check if code matches
    if (otp.code !== verifyOtpDto.code) {
      throw new BadRequestException('Invalid OTP code.');
    }

    // Mark OTP as verified (user identity confirmed)
    otp.verified = true;
    await this.paymentMethodOtpRepository.save(otp);

    // Note: Payment method verification is NOT changed here
    // It remains unverified until admin manually verifies it

    return {
      success: true,
      message:
        'User identity confirmed successfully. Payment method is pending admin verification.',
    };
  }
}
