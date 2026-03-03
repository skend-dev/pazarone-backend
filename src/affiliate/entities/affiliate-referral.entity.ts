import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('affiliate_referrals')
@Index(['affiliateId'])
@Index(['referralCode'], { unique: true })
export class AffiliateReferral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  affiliateId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'affiliateId' })
  affiliate: User;

  @Column({ unique: true })
  referralCode: string; // Unique referral code

  @Column({ default: true })
  isActive: boolean;

  @Column('int', { default: 0 })
  totalClicks: number; // Number of times referral link was clicked

  @Column('int', { default: 0 })
  totalOrders: number; // Number of orders made through this referral

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalEarnings: number; // Total commission earned

  @Column({ default: false })
  isAmbassador: boolean;

  /** Override for buyer referrals (product purchases). If null, use product.affiliateCommission */
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  buyerCommissionPercent: number | null;

  /** Commission % of platform fee for orders from sellers referred by this ambassador (Option B) */
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  sellerReferralCommissionPercent: number | null;

  /** Min withdrawal threshold for this ambassador. If set, overrides platform default */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  minWithdrawalThreshold: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

