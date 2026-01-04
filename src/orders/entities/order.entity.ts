import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

@Entity('orders')
@Index(['sellerId'])
@Index(['customerId'])
@Index(['affiliateId'])
@Index(['status'])
@Index(['createdAt'])
@Index(['paymentMethod'])
@Index(['sellerPaid'])
@Index(['adminPaid'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderNumber: string;

  @Column('uuid')
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column('uuid')
  customerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column('uuid', { nullable: true })
  affiliateId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'affiliateId' })
  affiliate: User | null;

  @Column({ type: 'varchar', nullable: true })
  referralCode: string | null;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number; // Total in buyer currency (charged amount)

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalAmountBase: number | null; // Total in seller's base currency (for reporting)

  @Column({ type: 'varchar', length: 3, nullable: true, default: 'MKD' })
  buyerCurrency: string | null; // Currency the buyer was charged in ('MKD' or 'EUR')

  @Column({ type: 'varchar', length: 3, nullable: true, default: 'MKD' })
  sellerBaseCurrency: string | null; // Seller's base currency ('MKD' or 'EUR')

  @Column('decimal', { precision: 10, scale: 4, nullable: true, default: 61.5 })
  exchangeRate: number | null; // Locked exchange rate at order time (61.5)

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: 'varchar', nullable: true })
  trackingId: string | null;

  @Column({ type: 'text', nullable: true })
  statusExplanation: string | null;

  @Column('jsonb')
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string;
  };

  @Column({ type: 'varchar', nullable: true })
  paymentMethod: string | null; // 'cod', 'card', 'bank_transfer', etc.

  @Column({ type: 'boolean', default: false })
  sellerPaid: boolean; // Whether seller has paid platform fee/affiliate commission (for COD)

  @Column({ type: 'boolean', default: false })
  adminPaid: boolean; // Whether admin has paid seller their portion (for Card)

  @Column({ type: 'timestamp', nullable: true })
  paymentSettledAt: Date | null; // When the payment was settled

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, {
    cascade: true,
  })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
