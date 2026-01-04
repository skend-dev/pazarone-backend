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
import { InvoiceItem } from './invoice-item.entity';

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Entity('invoices')
@Index(['sellerId'])
@Index(['status'])
@Index(['weekStartDate'])
@Index(['dueDate'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceNumber: string; // Format: INV-YYYY-WW-SELLERID (e.g., INV-2024-01-abc123)

  @Column('uuid')
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'date' })
  weekStartDate: Date; // Monday of the invoice week

  @Column({ type: 'date' })
  weekEndDate: Date; // Sunday of the invoice week

  @Column({ type: 'date' })
  dueDate: Date; // Payment deadline (Friday, 3-5 days after generation)

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status: InvoiceStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number; // Total amount seller owes (platform fee + affiliate commission)

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalAmountMKD: number | null; // Total in MKD

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalAmountEUR: number | null; // Total in EUR

  @Column('int')
  orderCount: number; // Number of orders in this invoice

  @OneToMany(() => InvoiceItem, (item) => item.invoice, {
    cascade: true,
  })
  items: InvoiceItem[];

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null; // When payment was received

  @Column({ type: 'text', nullable: true })
  paymentNotes: string | null; // Payment notes/reference

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
