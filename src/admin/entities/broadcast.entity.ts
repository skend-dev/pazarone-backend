import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('broadcasts')
@Index(['createdById'])
@Index(['createdAt'])
export class Broadcast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column('text')
  message: string;

  @Column({ type: 'varchar', length: 40 })
  broadcastType: string; // promote_products_affiliates | general_announcement | marketing_products_customers

  @Column('jsonb')
  targetAudience: string[]; // ['affiliate', 'seller', 'customer']

  @Column({ type: 'varchar', length: 20 })
  deliveryMethod: string; // 'email' | 'notification' | 'both'

  @Column('jsonb', { nullable: true })
  featuredProductIds: string[] | null;

  @Column('int', { default: 0 })
  emailSent: number;

  @Column('int', { default: 0 })
  notificationsCreated: number;

  @Column('int', { default: 0 })
  totalRecipients: number;

  /**
   * 'processing' while the background job is running,
   * 'done' when completed, 'failed' on unrecoverable error.
   * Defaults to 'done' so legacy rows remain unchanged.
   */
  @Column({ type: 'varchar', length: 20, default: 'done' })
  status: 'processing' | 'done' | 'failed';

  @Column({ default: false })
  isAutomated: boolean; // true = sent by scheduler (flash deals), false = manual admin broadcast

  @CreateDateColumn()
  createdAt: Date;

  @Column('uuid', { nullable: true })
  createdById: string | null; // null when isAutomated = true

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;
}
