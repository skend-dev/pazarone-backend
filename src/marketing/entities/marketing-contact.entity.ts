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
import { User, UserType } from '../../users/entities/user.entity';

export enum MarketingContactSource {
  REGISTERED = 'registered',
  IMPORT = 'import',
  MANUAL = 'manual',
  /** Imported from Infobip People (CDP) */
  INFOBIP = 'infobip',
}

@Entity('marketing_contacts')
@Index(['userId'])
@Index(['source'])
export class MarketingContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar', length: 20 })
  source: MarketingContactSource;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phoneE164: string | null;

  /** Full display name (synced from User.name for registered contacts). */
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gender: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  city: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  market: string | null;

  /** Optional segment label (import, manual, Infobip enrich). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  tag: string | null;

  /** Snapshot of User.userType at last sync (`seller` \| `affiliate` \| `customer` \| `admin`). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  userType: UserType | null;

  @Column({ type: 'boolean', default: false })
  emailMarketingOptIn: boolean;

  @Column({ type: 'boolean', default: false })
  viberMarketingOptIn: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  emailSuppressedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  viberSuppressedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  /** Last successful push to Infobip People (Customer Profiles), if enabled. */
  @Column({ type: 'timestamptz', nullable: true })
  infobipPeopleSyncedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  infobipPeopleSyncError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
