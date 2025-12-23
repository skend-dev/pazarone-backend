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
import { Order } from '../../orders/entities/order.entity';
import { Product } from '../../products/entities/product.entity';

export enum CommissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

@Entity('affiliate_commissions')
@Index(['affiliateId'])
@Index(['orderId'])
@Index(['status'])
@Index(['createdAt'])
export class AffiliateCommission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  affiliateId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'affiliateId' })
  affiliate: User;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('uuid')
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column('decimal', { precision: 10, scale: 2 })
  orderItemAmount: number; // Total amount for this item (price * quantity)

  @Column('decimal', { precision: 5, scale: 2 })
  commissionPercent: number; // Commission percentage from product

  @Column('decimal', { precision: 10, scale: 2 })
  commissionAmount: number; // Calculated commission (orderItemAmount * commissionPercent / 100)

  @Column({
    type: 'enum',
    enum: CommissionStatus,
    default: CommissionStatus.PENDING,
  })
  status: CommissionStatus;

  @Column('int')
  quantity: number; // Quantity of items

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

