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
  promotionEmailSchedule: string; // 'daily' | 'weekly' | 'custom'

  @Column({ type: 'int', default: 1 })
  promotionEmailScheduleDayOfWeek: number; // 0=Sunday … 6=Saturday (used when 'weekly')

  /**
   * @deprecated Superseded by promotionEmailScheduleSlots.
   * Kept in DB for backward compatibility but no longer written.
   */
  @Column('jsonb', { nullable: true })
  promotionEmailScheduleDays: number[] | null;

  /**
   * Per-day slots for schedule = 'custom'.
   * Each entry has a day (0=Sun … 6=Sat) and an hour (0–23, Europe/Skopje).
   * e.g. [{day:1,hour:9},{day:3,hour:14}] = Mon 9 AM + Wed 2 PM.
   * Null when unused (daily / weekly modes).
   */
  @Column('jsonb', { nullable: true })
  promotionEmailScheduleSlots: { day: number; hour: number }[] | null;

  @Column({ default: true })
  promotionEmailsFlashDealsEnabled: boolean;

  @Column({ default: true })
  promotionEmailsNewArrivalsEnabled: boolean;

  /** Hour of day (0–23, Europe/Skopje) at which automated emails are sent. Default: 9 */
  @Column({ type: 'int', default: 9 })
  promotionEmailSendHour: number;

  /** Max number of products included in each automated email. Default: 8 */
  @Column({ type: 'int', default: 8 })
  promotionEmailMaxProducts: number;

  /** Whether automated emails are sent to customers. Default: true */
  @Column({ default: true })
  promotionEmailTargetCustomers: boolean;

  /** Whether automated emails are sent to sellers. Default: true */
  @Column({ default: true })
  promotionEmailTargetSellers: boolean;

  /** Whether automated emails are sent to affiliates. Default: true */
  @Column({ default: true })
  promotionEmailTargetAffiliates: boolean;

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

