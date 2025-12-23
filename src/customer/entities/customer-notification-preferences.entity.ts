import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('customer_notification_preferences')
export class CustomerNotificationPreferences {
  @PrimaryColumn('uuid')
  customerId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column({ default: true })
  orderUpdates: boolean;

  @Column({ default: true })
  promotionalEmails: boolean;

  @Column({ default: false })
  productRecommendations: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

