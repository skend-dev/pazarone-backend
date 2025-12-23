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
  totalAmount: number;

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

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, {
    cascade: true,
  })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
