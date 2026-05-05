import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketingInfobipDeliveryEvent } from './entities/marketing-infobip-delivery-event.entity';
import { MarketingInfobipInboundMessage } from './entities/marketing-infobip-inbound-message.entity';
import { ListInfobipActivityQueryDto } from './dto/list-infobip-activity-query.dto';
import {
  normalizeInfobipResultArray,
  parseInfobipDeliveryItem,
  parseInfobipInboundItem,
} from './infobip-webhook.payload';

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

@Injectable()
export class MarketingInfobipWebhookService {
  private readonly logger = new Logger(MarketingInfobipWebhookService.name);

  constructor(
    @InjectRepository(MarketingInfobipDeliveryEvent)
    private readonly deliveryRepo: Repository<MarketingInfobipDeliveryEvent>,
    @InjectRepository(MarketingInfobipInboundMessage)
    private readonly inboundRepo: Repository<MarketingInfobipInboundMessage>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates `INFOBIP_WEBHOOK_SECRET` when set. Accepts Bearer, `X-Infobip-Webhook-Secret`,
   * or query `token` (as used in Infobip Viber BM URL configuration).
   */
  assertWebhookAuthorized(
    authHeader?: string,
    secretHeader?: string,
    tokenQuery?: string,
  ): void {
    const secret = this.configService
      .get<string>('INFOBIP_WEBHOOK_SECRET')
      ?.trim();
    if (!secret) return;
    const bearer =
      authHeader?.startsWith('Bearer ') || authHeader?.startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : null;
    const token = tokenQuery?.trim();
    if (bearer === secret || secretHeader === secret || token === secret) return;
    throw new UnauthorizedException('Invalid Infobip webhook credentials');
  }

  async ingestDeliveryReports(body: unknown): Promise<{
    received: number;
    stored: number;
  }> {
    const items = normalizeInfobipResultArray(body);
    if (items.length === 0) {
      this.logger.warn('Infobip delivery webhook: empty payload');
      return { received: 0, stored: 0 };
    }
    const rows = items.map((item) => {
      const p = parseInfobipDeliveryItem(item);
      return this.deliveryRepo.create({
        messageId: p.messageId,
        bulkId: p.bulkId,
        channel: p.channel,
        destination: p.destination,
        statusGroup: p.statusGroup,
        statusName: p.statusName,
        statusId: p.statusId,
        errorSummary: p.errorSummary,
        sentAt: p.sentAt,
        doneAt: p.doneAt,
        rawPayload: p.rawPayload,
      });
    });
    const res = await this.deliveryRepo.save(rows);
    return { received: items.length, stored: res.length };
  }

  async ingestInboundMessages(body: unknown): Promise<{
    received: number;
    stored: number;
    skippedDuplicate: number;
  }> {
    const items = normalizeInfobipResultArray(body);
    if (items.length === 0) {
      this.logger.warn('Infobip inbound webhook: empty payload');
      return { received: 0, stored: 0, skippedDuplicate: 0 };
    }
    let stored = 0;
    let skippedDuplicate = 0;
    for (const item of items) {
      const p = parseInfobipInboundItem(item);
      try {
        await this.inboundRepo.insert({
          messageId: p.messageId,
          fromMsisdn: p.fromMsisdn,
          toDestination: p.toDestination,
          channel: p.channel,
          textBody: p.textBody,
          receivedAt: p.receivedAt,
          rawPayload: p.rawPayload as object,
        });
        stored += 1;
      } catch (err) {
        if (isPgUniqueViolation(err)) {
          skippedDuplicate += 1;
        } else {
          throw err;
        }
      }
    }
    return {
      received: items.length,
      stored,
      skippedDuplicate,
    };
  }

  async listDeliveryEvents(query: ListInfobipActivityQueryDto): Promise<{
    items: MarketingInfobipDeliveryEvent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = query.q?.trim();
    const qb = this.deliveryRepo
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC');
    if (q) {
      qb.andWhere(
        `(e.messageId ILIKE :needle OR e.destination ILIKE :needle OR e.statusGroup ILIKE :needle OR e.statusName ILIKE :needle OR e.bulkId ILIKE :needle OR e.channel ILIKE :needle)`,
        { needle: `%${q}%` },
      );
    }
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async listInboundMessages(query: ListInfobipActivityQueryDto): Promise<{
    items: MarketingInfobipInboundMessage[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = query.q?.trim();
    const qb = this.inboundRepo
      .createQueryBuilder('m')
      .orderBy('m.createdAt', 'DESC');
    if (q) {
      qb.andWhere(
        `(m.messageId ILIKE :needle OR m.fromMsisdn ILIKE :needle OR m.toDestination ILIKE :needle OR m.channel ILIKE :needle OR m.textBody ILIKE :needle)`,
        { needle: `%${q}%` },
      );
    }
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
