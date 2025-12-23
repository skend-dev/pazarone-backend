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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

