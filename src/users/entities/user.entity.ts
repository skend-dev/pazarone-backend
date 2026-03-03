import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserType {
  SELLER = 'seller',
  AFFILIATE = 'affiliate',
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  @Index()
  email: string | null;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column()
  password: string;

  /** True when user has set a platform password (email signup or completed set-password). OAuth-only users start false until they set a password. */
  @Column({ type: 'boolean', default: true })
  hasPlatformPassword: boolean;

  @Column({
    type: 'enum',
    enum: UserType,
    default: UserType.SELLER,
  })
  userType: UserType;

  @Column({ type: 'varchar', nullable: true })
  market: string | null; // 'MK' for North Macedonia, 'KS' for Kosovo

  /** Ambassador who referred this seller (when signing up via ?ref=CODE) */
  @Column('uuid', { nullable: true })
  referredByAffiliateId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
