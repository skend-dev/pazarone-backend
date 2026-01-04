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

@Entity('affiliate_payment_methods')
@Index(['affiliateId'], { unique: true })
export class AffiliatePaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  affiliateId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'affiliateId' })
  affiliate: User;

  @Column()
  bankName: string;

  @Column()
  accountNumber: string;

  @Column()
  accountHolderName: string;

  @Column({ type: 'varchar', nullable: true })
  iban: string | null;

  @Column({ type: 'varchar', nullable: true })
  swiftCode: string | null;

  @Column({ type: 'text', nullable: true })
  bankAddress: string | null;

  @Column({ default: false })
  verified: boolean; // Admin verification status

  @Column({ type: 'text', nullable: true })
  verificationNotes: string | null; // Admin notes about verification

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

