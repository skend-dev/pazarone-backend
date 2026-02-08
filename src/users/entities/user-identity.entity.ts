import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export type IdentityProvider = 'google' | 'apple';

@Entity('user_identities')
@Index('UQ_user_identities_provider_providerUid', ['provider', 'providerUid'], {
  unique: true,
})
export class UserIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  provider: IdentityProvider;

  @Column({ type: 'varchar', length: 128 })
  providerUid: string;

  /** Email from provider at link time (may be null for Apple hide-email). */
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
