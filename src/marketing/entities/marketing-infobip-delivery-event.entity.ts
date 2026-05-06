import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('marketing_infobip_delivery_events')
@Index(['messageId'])
@Index(['createdAt'])
@Index(['destination'])
export class MarketingInfobipDeliveryEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  messageId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  bulkId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  channel: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  destination: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  statusGroup: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  statusName: string | null;

  @Column({ type: 'int', nullable: true })
  statusId: number | null;

  @Column({ type: 'text', nullable: true })
  errorSummary: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  doneAt: Date | null;

  @Column({ type: 'jsonb' })
  rawPayload: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
