import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { AffiliateReferral } from '../affiliate/entities/affiliate-referral.entity';
import {
  AffiliateCommission,
  CommissionStatus,
} from '../affiliate/entities/affiliate-commission.entity';
import {
  AffiliateWithdrawal,
  WithdrawalStatus,
} from '../affiliate/entities/affiliate-withdrawal.entity';
import { AffiliatePaymentMethod } from '../affiliate/entities/affiliate-payment-method.entity';
import { AdminQueryDto } from './dto/admin-query.dto';
import { VerifyPaymentMethodDto } from './dto/verify-payment-method.dto';
import { RejectPaymentMethodDto } from './dto/reject-payment-method.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

@Injectable()
export class AdminAffiliatesService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(AffiliateReferral)
    private affiliateReferralRepository: Repository<AffiliateReferral>,
    @InjectRepository(AffiliateCommission)
    private affiliateCommissionRepository: Repository<AffiliateCommission>,
    @InjectRepository(AffiliateWithdrawal)
    private affiliateWithdrawalRepository: Repository<AffiliateWithdrawal>,
    @InjectRepository(AffiliatePaymentMethod)
    private affiliatePaymentMethodRepository: Repository<AffiliatePaymentMethod>,
  ) {}

  async findAll(query: AdminQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .where('user.userType = :userType', { userType: UserType.AFFILIATE })
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    // Get stats for each affiliate
    const affiliatesWithStats = await Promise.all(
      users.map(async (user) => {
        const referral = await this.affiliateReferralRepository.findOne({
          where: { affiliateId: user.id, isActive: true },
        });

        const [totalEarnings, totalCommissions, pendingWithdrawals] =
          await Promise.all([
            this.affiliateCommissionRepository
              .createQueryBuilder('commission')
              .select('SUM(commission.commissionAmount)', 'total')
              .where('commission.affiliateId = :affiliateId', {
                affiliateId: user.id,
              })
              .andWhere('commission.status IN (:...statuses)', {
                statuses: [CommissionStatus.APPROVED, CommissionStatus.PAID],
              })
              .getRawOne(),
            this.affiliateCommissionRepository.count({
              where: { affiliateId: user.id },
            }),
            this.affiliateWithdrawalRepository.find({
              where: {
                affiliateId: user.id,
                status: In([
                  WithdrawalStatus.PENDING,
                  WithdrawalStatus.APPROVED,
                ]),
              },
            }),
          ]);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          referralCode: referral?.referralCode || null,
          totalClicks: referral?.totalClicks || 0,
          totalOrders: referral?.totalOrders || 0,
          totalEarnings: parseFloat(totalEarnings?.total || '0'),
          totalCommissions,
          pendingWithdrawals: pendingWithdrawals.reduce(
            (sum, w) => sum + parseFloat(w.amount.toString()),
            0,
          ),
          createdAt: user.createdAt,
        };
      }),
    );

    return {
      affiliates: affiliatesWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single affiliate by ID with detailed statistics
   */
  async findOne(affiliateId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: affiliateId, userType: UserType.AFFILIATE },
    });

    if (!user) {
      throw new NotFoundException('Affiliate not found');
    }

    const referral = await this.affiliateReferralRepository.findOne({
      where: { affiliateId: user.id, isActive: true },
    });

    const [totalEarnings, totalCommissions, pendingWithdrawals] =
      await Promise.all([
        this.affiliateCommissionRepository
          .createQueryBuilder('commission')
          .select('SUM(commission.commissionAmount)', 'total')
          .where('commission.affiliateId = :affiliateId', {
            affiliateId: user.id,
          })
          .andWhere('commission.status IN (:...statuses)', {
            statuses: [CommissionStatus.APPROVED, CommissionStatus.PAID],
          })
          .getRawOne(),
        this.affiliateCommissionRepository.count({
          where: { affiliateId: user.id },
        }),
        this.affiliateWithdrawalRepository.find({
          where: {
            affiliateId: user.id,
            status: In([WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED]),
          },
        }),
      ]);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      referralCode: referral?.referralCode || null,
      totalClicks: referral?.totalClicks || 0,
      totalOrders: referral?.totalOrders || 0,
      totalEarnings: parseFloat(totalEarnings?.total || '0'),
      totalCommissions,
      pendingWithdrawals: pendingWithdrawals.reduce(
        (sum, w) => sum + parseFloat(w.amount.toString()),
        0,
      ),
      createdAt: user.createdAt,
    };
  }

  /**
   * Get payment method by affiliate ID
   */
  async getPaymentMethodByAffiliateId(affiliateId: string) {
    // First verify the affiliate exists
    const user = await this.usersRepository.findOne({
      where: { id: affiliateId, userType: UserType.AFFILIATE },
    });

    if (!user) {
      throw new NotFoundException('Affiliate not found');
    }

    const paymentMethod = await this.affiliatePaymentMethodRepository.findOne({
      where: { affiliateId },
      relations: ['affiliate'],
    });

    if (!paymentMethod) {
      throw new NotFoundException(
        'Payment method not found for this affiliate',
      );
    }

    return {
      id: paymentMethod.id,
      affiliate: {
        id: paymentMethod.affiliate.id,
        name: paymentMethod.affiliate.name,
        email: paymentMethod.affiliate.email,
      },
      bankName: paymentMethod.bankName,
      accountNumber: paymentMethod.accountNumber, // Unmasked for admin
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

  async getWithdrawals(query: AdminQueryDto & { status?: WithdrawalStatus }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.affiliateWithdrawalRepository
      .createQueryBuilder('withdrawal')
      .leftJoinAndSelect('withdrawal.affiliate', 'affiliate')
      .orderBy('withdrawal.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.status) {
      queryBuilder.andWhere('withdrawal.status = :status', {
        status: query.status,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(affiliate.name ILIKE :search OR affiliate.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [withdrawals, total] = await queryBuilder.getManyAndCount();

    return {
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        affiliate: {
          id: w.affiliate.id,
          name: w.affiliate.name,
          email: w.affiliate.email,
        },
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

  async updateWithdrawalStatus(
    withdrawalId: string,
    status: WithdrawalStatus,
    notes?: string,
  ) {
    const withdrawal = await this.affiliateWithdrawalRepository.findOne({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      return null;
    }

    const oldStatus = withdrawal.status;
    withdrawal.status = status;
    if (notes) {
      withdrawal.notes = notes;
    }

    const updatedWithdrawal =
      await this.affiliateWithdrawalRepository.save(withdrawal);

    // When withdrawal is marked as PAID, mark the corresponding commissions as PAID
    // This ensures commissions are properly tracked as paid out
    if (
      status === WithdrawalStatus.PAID &&
      oldStatus !== WithdrawalStatus.PAID
    ) {
      await this.markCommissionsAsPaidForWithdrawal(
        withdrawal.affiliateId,
        parseFloat(withdrawal.amount.toString()),
      );
    }

    return updatedWithdrawal;
  }

  /**
   * Mark commissions as PAID when a withdrawal is marked as PAID
   * This marks APPROVED commissions as PAID up to the withdrawal amount
   */
  private async markCommissionsAsPaidForWithdrawal(
    affiliateId: string,
    withdrawalAmount: number,
  ): Promise<void> {
    // Get all APPROVED commissions for this affiliate, ordered by oldest first
    const approvedCommissions = await this.affiliateCommissionRepository.find({
      where: {
        affiliateId,
        status: CommissionStatus.APPROVED,
      },
      order: {
        createdAt: 'ASC', // Mark oldest commissions first (FIFO)
      },
    });

    let remainingAmount = withdrawalAmount;

    // Mark commissions as PAID until we've covered the withdrawal amount
    for (const commission of approvedCommissions) {
      if (remainingAmount <= 0) {
        break;
      }

      const commissionAmount = parseFloat(
        commission.commissionAmount.toString(),
      );

      if (commissionAmount <= remainingAmount) {
        // Mark entire commission as PAID
        commission.status = CommissionStatus.PAID;
        remainingAmount -= commissionAmount;
      } else {
        // This shouldn't happen in practice, but if a single commission is larger
        // than the withdrawal, we don't mark it as PAID (partial payments not supported)
        break;
      }
    }

    // Save all updated commissions
    if (approvedCommissions.some((c) => c.status === CommissionStatus.PAID)) {
      await this.affiliateCommissionRepository.save(approvedCommissions);
    }
  }

  async getStatistics() {
    const [
      totalAffiliates,
      totalReferrals,
      totalCommissions,
      totalWithdrawals,
    ] = await Promise.all([
      this.usersRepository.count({ where: { userType: UserType.AFFILIATE } }),
      this.affiliateReferralRepository.count({ where: { isActive: true } }),
      this.affiliateCommissionRepository.count(),
      this.affiliateWithdrawalRepository.count(),
    ]);

    const totalEarnings = await this.affiliateCommissionRepository
      .createQueryBuilder('commission')
      .select('SUM(commission.commissionAmount)', 'total')
      .where('commission.status IN (:...statuses)', {
        statuses: [CommissionStatus.APPROVED, CommissionStatus.PAID],
      })
      .getRawOne();

    const pendingWithdrawals = await this.affiliateWithdrawalRepository.find({
      where: { status: WithdrawalStatus.PENDING },
    });

    return {
      totalAffiliates,
      totalReferrals,
      totalCommissions,
      totalWithdrawals,
      totalEarnings: parseFloat(totalEarnings?.total || '0'),
      pendingWithdrawalsCount: pendingWithdrawals.length,
      pendingWithdrawalsAmount: pendingWithdrawals.reduce(
        (sum, w) => sum + parseFloat(w.amount.toString()),
        0,
      ),
    };
  }

  /**
   * Get all affiliate payment methods with filtering and pagination
   */
  async getPaymentMethods(query: AdminQueryDto & { verified?: boolean }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.affiliatePaymentMethodRepository
      .createQueryBuilder('paymentMethod')
      .leftJoinAndSelect('paymentMethod.affiliate', 'affiliate')
      .orderBy('paymentMethod.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    // Filter by verification status
    if (query.verified !== undefined) {
      queryBuilder.andWhere('paymentMethod.verified = :verified', {
        verified: query.verified,
      });
    }

    // Search by affiliate name or email
    if (query.search) {
      queryBuilder.andWhere(
        '(affiliate.name ILIKE :search OR affiliate.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [paymentMethods, total] = await queryBuilder.getManyAndCount();

    return {
      paymentMethods: paymentMethods.map((pm) => ({
        id: pm.id,
        affiliate: {
          id: pm.affiliate.id,
          name: pm.affiliate.name,
          email: pm.affiliate.email,
        },
        bankName: pm.bankName,
        accountNumber: pm.accountNumber, // Unmasked for admin view
        accountHolderName: pm.accountHolderName,
        iban: pm.iban,
        swiftCode: pm.swiftCode,
        bankAddress: pm.bankAddress,
        verified: pm.verified,
        verificationNotes: pm.verificationNotes,
        createdAt: pm.createdAt,
        updatedAt: pm.updatedAt,
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
   * Get a single payment method by ID (with unmasked account number)
   */
  async getPaymentMethod(paymentMethodId: string) {
    const paymentMethod = await this.affiliatePaymentMethodRepository.findOne({
      where: { id: paymentMethodId },
      relations: ['affiliate'],
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    return {
      id: paymentMethod.id,
      affiliate: {
        id: paymentMethod.affiliate.id,
        name: paymentMethod.affiliate.name,
        email: paymentMethod.affiliate.email,
      },
      bankName: paymentMethod.bankName,
      accountNumber: paymentMethod.accountNumber, // Unmasked for admin
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

  /**
   * Verify a payment method
   */
  async verifyPaymentMethod(
    paymentMethodId: string,
    verifyDto: VerifyPaymentMethodDto,
  ) {
    const paymentMethod = await this.affiliatePaymentMethodRepository.findOne({
      where: { id: paymentMethodId },
      relations: ['affiliate'],
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    if (paymentMethod.verified) {
      throw new BadRequestException('Payment method is already verified');
    }

    paymentMethod.verified = true;
    paymentMethod.verificationNotes = verifyDto.notes || 'Verified by admin';

    const updated =
      await this.affiliatePaymentMethodRepository.save(paymentMethod);

    return {
      id: updated.id,
      affiliate: {
        id: paymentMethod.affiliate.id,
        name: paymentMethod.affiliate.name,
        email: paymentMethod.affiliate.email,
      },
      bankName: updated.bankName,
      accountNumber: updated.accountNumber,
      accountHolderName: updated.accountHolderName,
      iban: updated.iban,
      swiftCode: updated.swiftCode,
      bankAddress: updated.bankAddress,
      verified: updated.verified,
      verificationNotes: updated.verificationNotes,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Reject a payment method
   */
  async rejectPaymentMethod(
    paymentMethodId: string,
    rejectDto: RejectPaymentMethodDto,
  ) {
    const paymentMethod = await this.affiliatePaymentMethodRepository.findOne({
      where: { id: paymentMethodId },
      relations: ['affiliate'],
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    paymentMethod.verified = false;
    paymentMethod.verificationNotes = rejectDto.notes;

    const updated =
      await this.affiliatePaymentMethodRepository.save(paymentMethod);

    return {
      id: updated.id,
      affiliate: {
        id: paymentMethod.affiliate.id,
        name: paymentMethod.affiliate.name,
        email: paymentMethod.affiliate.email,
      },
      bankName: updated.bankName,
      accountNumber: updated.accountNumber,
      accountHolderName: updated.accountHolderName,
      iban: updated.iban,
      swiftCode: updated.swiftCode,
      bankAddress: updated.bankAddress,
      verified: updated.verified,
      verificationNotes: updated.verificationNotes,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Get withdrawals for a specific affiliate
   */
  async getAffiliateWithdrawals(
    affiliateId: string,
    query: AdminQueryDto & { status?: WithdrawalStatus },
  ) {
    // First verify the affiliate exists
    const user = await this.usersRepository.findOne({
      where: { id: affiliateId, userType: UserType.AFFILIATE },
    });

    if (!user) {
      throw new NotFoundException('Affiliate not found');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.affiliateWithdrawalRepository
      .createQueryBuilder('withdrawal')
      .leftJoinAndSelect('withdrawal.affiliate', 'affiliate')
      .where('withdrawal.affiliateId = :affiliateId', { affiliateId })
      .orderBy('withdrawal.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.status) {
      queryBuilder.andWhere('withdrawal.status = :status', {
        status: query.status,
      });
    }

    const [withdrawals, total] = await queryBuilder.getManyAndCount();

    return {
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        affiliate: {
          id: w.affiliate.id,
          name: w.affiliate.name,
          email: w.affiliate.email,
        },
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

  /**
   * Get commissions for a specific affiliate
   */
  async getAffiliateCommissions(
    affiliateId: string,
    query: AdminQueryDto & { status?: CommissionStatus },
  ) {
    // First verify the affiliate exists
    const user = await this.usersRepository.findOne({
      where: { id: affiliateId, userType: UserType.AFFILIATE },
    });

    if (!user) {
      throw new NotFoundException('Affiliate not found');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.affiliateCommissionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.order', 'order')
      .leftJoinAndSelect('commission.product', 'product')
      .leftJoinAndSelect('commission.affiliate', 'affiliate')
      .where('commission.affiliateId = :affiliateId', { affiliateId })
      .orderBy('commission.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.status) {
      queryBuilder.andWhere('commission.status = :status', {
        status: query.status,
      });
    }

    const [commissions, total] = await queryBuilder.getManyAndCount();

    return {
      commissions: commissions.map((c) => ({
        id: c.id,
        affiliate: {
          id: c.affiliate.id,
          name: c.affiliate.name,
          email: c.affiliate.email,
        },
        orderNumber: c.order?.orderNumber || null,
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
}
