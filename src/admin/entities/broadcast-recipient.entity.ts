import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Broadcast } from './broadcast.entity';

@Entity('broadcast_recipients')
@Index(['broadcastId'])
@Index(['broadcastId', 'emailNormalized'])
export class BroadcastRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  broadcastId: string;

  @ManyToOne(() => Broadcast, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broadcastId' })
  broadcast: Broadcast;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  emailNormalized: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column('uuid', { nullable: true })
  userId: string | null;

  /** email | notification */
  @Column({ type: 'varchar', length: 20 })
  channel: 'email' | 'notification';

  /** sent | failed */
  @Column({ type: 'varchar', length: 20 })
  status: 'sent' | 'failed';

  @CreateDateColumn()
  sentAt: Date;
}
