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

  // Platform Fee Settings
  @Column('decimal', { precision: 5, scale: 2, default: 7.0 })
  platformFeePercent: number; // Platform fee percentage (default: 7%)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

