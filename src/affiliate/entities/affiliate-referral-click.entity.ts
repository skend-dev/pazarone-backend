import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';
import { AffiliateReferral } from './affiliate-referral.entity';

@Entity('affiliate_referral_clicks')
@Index(['affiliateId'])
@Index(['productId'])
@Index(['affiliateId', 'productId'])
@Index(['referralCode'])
@Index(['clickedAt'])
export class AffiliateReferralClick {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  affiliateId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'affiliateId' })
  affiliate: User;

  @Column('uuid', { nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @Column()
  referralCode: string;

  @ManyToOne(() => AffiliateReferral, { nullable: true })
  @JoinColumn({ name: 'referralCode', referencedColumnName: 'referralCode' })
  referral: AffiliateReferral | null;

  @CreateDateColumn()
  clickedAt: Date;
}
