import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, default: 'main' })
  key: string; // For future extensibility, default to 'main'

  // Affiliate Settings
  @Column('decimal', { precision: 10, scale: 2, default: 1000 })
  affiliateMinWithdrawalThreshold: number; // Minimum withdrawal amount in den

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  affiliateCommissionMin: number; // Minimum affiliate commission percentage (default: 0%)

  @Column('decimal', { precision: 5, scale: 2, default: 100 })
  affiliateCommissionMax: number; // Maximum affiliate commission percentage (default: 100%)

  // Platform Fee Settings
  @Column('decimal', { precision: 5, scale: 2, default: 7.0 })
  platformFeePercent: number; // Platform fee percentage (default: 7%)

  // Automatic Promotion Emails
  @Column({ default: false })
  automaticPromotionEmailsEnabled: boolean; // Master switch (default: false)

  @Column({ type: 'varchar', length: 20, default: 'daily' })
  promotionEmailSchedule: string; // 'daily' | 'weekly'

  @Column({ type: 'int', default: 1 })
  promotionEmailScheduleDayOfWeek: number; // 0=Sunday, 1=Monday, ... 6=Saturday (used when weekly)

  @Column({ default: true })
  promotionEmailsFlashDealsEnabled: boolean; // Send flash deal emails (popular + on sale)

  @Column({ default: true })
  promotionEmailsNewArrivalsEnabled: boolean; // Send new arrivals emails (newest products)

  // Bank Transfer Details (stored as JSON)
  @Column('jsonb', { nullable: true })
  bankTransferDetails: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    iban?: string;
    swift?: string;
    reference?: string;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

