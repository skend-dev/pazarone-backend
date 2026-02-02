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

  @CreateDateColumn()
  createdAt: Date;

  @Column('uuid')
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;
}
