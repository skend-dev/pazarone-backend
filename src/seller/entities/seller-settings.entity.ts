import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('seller_settings')
export class SellerSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  sellerId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  // Account settings
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  // Store settings
  @Column({ type: 'varchar', nullable: true })
  storeName: string | null;

  @Column('text', { nullable: true })
  storeDescription: string | null;

  @Column({ type: 'varchar', nullable: true })
  logo: string | null;

  // Payment settings
  @Column({ type: 'varchar', nullable: true })
  bankAccount: string | null; // Legacy field

  @Column({ type: 'varchar', nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', nullable: true })
  accountNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  accountHolder: string | null;

  @Column({ type: 'varchar', nullable: true })
  iban: string | null;

  @Column({ type: 'varchar', nullable: true })
  swift: string | null;

  @Column({ type: 'varchar', nullable: true })
  taxId: string | null;

  @Column({ default: false })
  accountVerified: boolean;

  @Column({ default: false })
  verified: boolean; // Verified sellers get auto-approval for products

  // Platform fee (null = use platform default)
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  platformFeePercent: number | null;

  // Shipping settings
  @Column('simple-array', { nullable: true })
  shippingCountries: string[] | null; // Array of supported shipping countries

  // Notification settings
  @Column({ default: true })
  notificationsOrders: boolean;

  @Column({ default: true })
  notificationsReviews: boolean;

  @Column({ default: true })
  notificationsMessages: boolean;

  @Column({ default: true })
  notificationsPromotions: boolean;

  @Column({ type: 'varchar', nullable: true })
  telegramChatId: string | null;

  // Payment restriction flags
  @Column({ default: false })
  paymentRestricted: boolean; // True if seller has overdue invoices (restricts orders and listings)

  @Column({ type: 'timestamp', nullable: true })
  paymentRestrictedAt: Date | null; // When payment restriction was applied

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
