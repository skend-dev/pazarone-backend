import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { AffiliateReferral } from '../affiliate/entities/affiliate-referral.entity';
import { AffiliateCommission, CommissionStatus } from '../affiliate/entities/affiliate-commission.entity';
import { AffiliateWithdrawal, WithdrawalStatus } from '../affiliate/entities/affiliate-withdrawal.entity';
import { AdminQueryDto } from './dto/admin-query.dto';

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

        const [totalEarnings, totalCommissions, pendingWithdrawals] = await Promise.all([
          this.affiliateCommissionRepository
            .createQueryBuilder('commission')
            .select('SUM(commission.commissionAmount)', 'total')
            .where('commission.affiliateId = :affiliateId', { affiliateId: user.id })
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
      queryBuilder.andWhere('withdrawal.status = :status', { status: query.status });
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

    withdrawal.status = status;
    if (notes) {
      withdrawal.notes = notes;
    }

    return await this.affiliateWithdrawalRepository.save(withdrawal);
  }

  async getStatistics() {
    const [totalAffiliates, totalReferrals, totalCommissions, totalWithdrawals] = await Promise.all([
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
}

