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
import { Invoice } from './invoice.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('invoice_items')
@Index(['invoiceId'])
@Index(['orderId'])
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderNumber: string; // For quick reference

  @Column({ type: 'date' })
  deliveryDate: Date; // When order was delivered

  @Column('decimal', { precision: 10, scale: 2 })
  productPrice: number; // COD amount (totalAmountBase)

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  productPriceMKD: number | null; // Product price in MKD

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  productPriceEUR: number | null; // Product price in EUR

  @Column('decimal', { precision: 5, scale: 2 })
  platformFeePercent: number; // Platform fee percentage

  @Column('decimal', { precision: 10, scale: 2 })
  platformFee: number; // Platform fee amount

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  platformFeeMKD: number | null; // Platform fee in MKD

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  platformFeeEUR: number | null; // Platform fee in EUR

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  affiliateFeePercent: number | null; // Affiliate commission percentage (if applicable)

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  affiliateFee: number; // Affiliate commission amount

  @Column('decimal', { precision: 10, scale: 2, nullable: true, default: 0 })
  affiliateFeeMKD: number | null; // Affiliate commission in MKD

  @Column('decimal', { precision: 10, scale: 2, nullable: true, default: 0 })
  affiliateFeeEUR: number | null; // Affiliate commission in EUR

  @Column('decimal', { precision: 10, scale: 2 })
  totalOwed: number; // Total amount seller owes for this order (platformFee + affiliateFee)

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalOwedMKD: number | null; // Total owed in MKD

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalOwedEUR: number | null; // Total owed in EUR

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
