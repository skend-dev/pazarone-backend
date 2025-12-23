import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_verifications')
@Index(['email', 'code'])
@Index(['email', 'token'])
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  email: string;

  @Column()
  code: string; // 6-digit verification code

  @Column({ type: 'varchar', nullable: true })
  @Index()
  token: string | null; // JWT token for email link verification

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
