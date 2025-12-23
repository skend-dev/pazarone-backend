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

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
}

@Entity('affiliate_withdrawals')
@Index(['affiliateId'])
@Index(['status'])
@Index(['createdAt'])
export class AffiliateWithdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  affiliateId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'affiliateId' })
  affiliate: User;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number; // Withdrawal amount

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  @Column({ type: 'text', nullable: true })
  notes: string; // Admin notes or rejection reason

  @Column({ type: 'text', nullable: true })
  paymentMethod: string; // e.g., 'bank_transfer', 'paypal', etc.

  @Column({ type: 'text', nullable: true })
  paymentDetails: string; // Payment account details (JSON string or plain text)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
