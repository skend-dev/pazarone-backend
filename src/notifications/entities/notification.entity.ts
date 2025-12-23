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

export enum NotificationType {
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_CANCELLED = 'order_cancelled',
  ORDER_COMPLETED = 'order_completed',
  PRODUCT_APPROVED = 'product_approved',
  PRODUCT_REJECTED = 'product_rejected',
  PRODUCT_LOW_STOCK = 'product_low_stock',
  REVIEW_RECEIVED = 'review_received',
  AFFILIATE_COMMISSION = 'affiliate_commission',
  WITHDRAWAL_APPROVED = 'withdrawal_approved',
  WITHDRAWAL_REJECTED = 'withdrawal_rejected',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

@Entity('notifications')
@Index(['userId', 'status'])
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.UNREAD,
  })
  status: NotificationStatus;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any> | null; // Additional data like orderId, productId, etc.

  @Column({ type: 'varchar', nullable: true })
  link: string | null; // URL to navigate when notification is clicked

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;
}
