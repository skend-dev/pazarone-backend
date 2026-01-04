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

