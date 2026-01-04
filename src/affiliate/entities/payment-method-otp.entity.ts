import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('payment_method_otps')
@Index(['affiliateId'])
@Index(['affiliateId', 'verified'])
export class PaymentMethodOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  affiliateId: string;

  @Column()
  code: string; // 6-digit OTP code

  @Column({ default: false })
  verified: boolean; // Whether OTP has been verified

  @Column({ type: 'timestamp' })
  expiresAt: Date; // OTP expiration time

  @CreateDateColumn()
  createdAt: Date;
}

