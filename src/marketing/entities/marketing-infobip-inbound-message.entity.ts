import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('marketing_infobip_inbound_messages')
@Index(['createdAt'])
@Index(['fromMsisdn'])
export class MarketingInfobipInboundMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  messageId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  fromMsisdn: string | null;

  @Column({ type: 'varchar', length: 96, nullable: true })
  toDestination: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  channel: string | null;

  @Column({ type: 'text', nullable: true })
  textBody: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ type: 'jsonb' })
  rawPayload: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
