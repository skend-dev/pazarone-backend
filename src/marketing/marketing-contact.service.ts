import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, SelectQueryBuilder } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import {
  MarketingContact,
  MarketingContactSource,
} from './entities/marketing-contact.entity';
import { ListMarketingContactsQueryDto } from './dto/list-marketing-contacts-query.dto';
import { PatchMarketingContactDto } from './dto/patch-marketing-contact.dto';
import { CreateMarketingContactDto } from './dto/create-marketing-contact.dto';
import { MarketingContactSyncService } from './marketing-contact-sync.service';
import { normalizePhoneToE164 } from './utils/phone-normalize';
import {
  AudienceFilterInput,
  audienceFiltersFromListQuery,
} from './audience-filter.input';
import type { ParsedInfobipPerson } from './infobip-person.types';
import { InfobipPeopleService } from './infobip-people.service';
import { MarketingInfobipContactPushService } from './marketing-infobip-contact-push.service';
import { normalizeMarketingGenderInput } from './utils/marketing-gender';

@Injectable()
export class MarketingContactService {
  constructor(
    @InjectRepository(MarketingContact)
    private readonly marketingContactRepository: Repository<MarketingContact>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly marketingContactSyncService: MarketingContactSyncService,
    private readonly infobipPeopleService: InfobipPeopleService,
    private readonly infobipContactPush: MarketingInfobipContactPushService,
  ) {}

  async findAllPaged(query: ListMarketingContactsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = audienceFiltersFromListQuery(query);
    const qb = this.marketingContactRepository.createQueryBuilder('c');
    this.applyAudienceFilters(qb, filters);
    qb.orderBy('c.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [contacts, total] = await qb.getManyAndCount();
    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  private applyAudienceFilters(
    qb: SelectQueryBuilder<MarketingContact>,
    f: AudienceFilterInput,
  ): void {
    const qTrim = f.q?.trim();

    if (qTrim) {
      const normalizedPhone = normalizePhoneToE164(qTrim);
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('c.email ILIKE :q', { q: `%${qTrim}%` });
          sub.orWhere('c.name ILIKE :q', { q: `%${qTrim}%` });
          sub.orWhere('c.phoneE164 ILIKE :q', { q: `%${qTrim}%` });
          sub.orWhere('c.city ILIKE :q', { q: `%${qTrim}%` });
          sub.orWhere('c.address ILIKE :q', { q: `%${qTrim}%` });
          sub.orWhere('c.gender ILIKE :q', { q: `%${qTrim}%` });
          sub.orWhere('c.market ILIKE :q', { q: `%${qTrim}%` });
          sub.orWhere('c.tag ILIKE :q', { q: `%${qTrim}%` });
          if (normalizedPhone) {
            sub.orWhere('c.phoneE164 = :e164', { e164: normalizedPhone });
          }
        }),
      );
    }

    if (f.source) {
      qb.andWhere('c.source = :source', { source: f.source });
    }

    if (f.emailMarketingOptIn !== undefined) {
      qb.andWhere('c.emailMarketingOptIn = :emo', {
        emo: f.emailMarketingOptIn,
      });
    }

    if (f.viberMarketingOptIn !== undefined) {
      qb.andWhere('c.viberMarketingOptIn = :vmo', {
        vmo: f.viberMarketingOptIn,
      });
    }

    if (f.userType) {
      qb.andWhere('c.userType = :ut', { ut: f.userType });
    }

    if (f.hasUser === true) {
      qb.andWhere('c.userId IS NOT NULL');
    } else if (f.hasUser === false) {
      qb.andWhere('c.userId IS NULL');
    }

    if (f.market?.length) {
      qb.andWhere('LOWER(TRIM(c.market)) = LOWER(TRIM(:mkt))', {
        mkt: f.market,
      });
    }

    if (f.gender?.length) {
      qb.andWhere('LOWER(TRIM(c.gender)) = LOWER(TRIM(:gen))', {
        gen: f.gender,
      });
    }

    if (f.city?.length) {
      qb.andWhere('c.city ILIKE :cityPat', { cityPat: `%${f.city}%` });
    }

    if (f.tag?.length) {
      qb.andWhere('c.tag ILIKE :tagPat', { tagPat: `%${f.tag}%` });
    }

    if (f.contactChannel === 'email') {
      qb.andWhere("c.email IS NOT NULL AND TRIM(c.email) <> ''");
    } else if (f.contactChannel === 'phone') {
      qb.andWhere("c.phoneE164 IS NOT NULL AND TRIM(c.phoneE164) <> ''");
    }
  }

  async findOne(id: string): Promise<MarketingContact> {
    const c = await this.marketingContactRepository.findOne({
      where: { id },
    });
    if (!c) throw new NotFoundException('Marketing contact not found');
    return c;
  }

  async createManual(
    dto: CreateMarketingContactDto,
  ): Promise<MarketingContact> {
    const emailNorm =
      dto.email && dto.email.trim() !== ''
        ? dto.email.trim().toLowerCase()
        : null;
    const rawPhone = dto.phone?.trim() ?? '';
    let phoneE164: string | null = null;
    if (rawPhone) {
      phoneE164 = normalizePhoneToE164(rawPhone);
      if (!phoneE164) {
        throw new BadRequestException(
          'Could not normalize phone number — check country or format.',
        );
      }
    }
    MarketingContactService.assertHasContactChannel(emailNorm, phoneE164);

    await this.ensureContactIdentifiersUnique(emailNorm, phoneE164);

    const emailOptIn = dto.emailMarketingOptIn === true;
    const viberOptIn = dto.viberMarketingOptIn === true;

    const entity = this.marketingContactRepository.create({
      userId: null,
      source: MarketingContactSource.MANUAL,
      email: emailNorm,
      phoneE164,
      name: dto.name?.trim() ? dto.name.trim().slice(0, 512) : null,
      gender: dto.gender ?? null,
      city: dto.city?.trim() ? dto.city.trim().slice(0, 256) : null,
      address: dto.address?.trim() ? dto.address.trim().slice(0, 2000) : null,
      market: dto.market?.trim() ? dto.market.trim().slice(0, 10) : null,
      tag: dto.tag?.trim() ? dto.tag.trim().slice(0, 128) : null,
      userType: null,
      emailMarketingOptIn: emailOptIn,
      viberMarketingOptIn: viberOptIn,
      emailSuppressedAt: emailOptIn ? null : new Date(),
      viberSuppressedAt: viberOptIn ? null : new Date(),
      metadata: { kind: 'admin_manual_create' },
    });

    const saved = await this.marketingContactRepository.save(entity);
    await this.infobipContactPush.pushIfPhonePresent(saved);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const res = await this.marketingContactRepository.delete({ id });
    if (!res.affected) {
      throw new NotFoundException('Marketing contact not found');
    }
  }

  async patch(
    id: string,
    dto: PatchMarketingContactDto,
  ): Promise<MarketingContact> {
    const c = await this.findOne(id);

    if (dto.email !== undefined) {
      const t = dto.email?.trim();
      c.email = t ? t.toLowerCase() : null;
    }
    if (dto.phone !== undefined) {
      if (dto.phone === null || dto.phone === '') {
        c.phoneE164 = null;
      } else {
        const raw = String(dto.phone).trim();
        const e164 = normalizePhoneToE164(raw);
        if (!e164) {
          throw new BadRequestException(
            'Could not normalize phone number — check country or format.',
          );
        }
        c.phoneE164 = e164;
      }
    }
    if (dto.market !== undefined) {
      const t = dto.market?.trim();
      c.market = t ? t.slice(0, 10) : null;
    }
    if (dto.tag !== undefined) {
      const t = dto.tag?.trim();
      c.tag = t ? t.slice(0, 128) : null;
    }
    if (dto.name !== undefined) {
      const t = dto.name?.trim();
      c.name = t ? t.slice(0, 512) : null;
    }
    if (dto.gender !== undefined) {
      c.gender = dto.gender;
    }
    if (dto.city !== undefined) {
      const t = dto.city?.trim();
      c.city = t ? t.slice(0, 256) : null;
    }
    if (dto.address !== undefined) {
      const t = dto.address?.trim();
      c.address = t ? t.slice(0, 2000) : null;
    }
    if (dto.emailMarketingOptIn !== undefined) {
      c.emailMarketingOptIn = dto.emailMarketingOptIn;
      if (dto.emailMarketingOptIn) {
        c.emailSuppressedAt = null;
      }
    }
    if (dto.viberMarketingOptIn !== undefined) {
      c.viberMarketingOptIn = dto.viberMarketingOptIn;
      if (dto.viberMarketingOptIn) {
        c.viberSuppressedAt = null;
      }
    }
    if (dto.emailSuppressedAt !== undefined) {
      if (dto.emailSuppressedAt === null) {
        c.emailSuppressedAt = null;
      } else {
        c.emailSuppressedAt = new Date(dto.emailSuppressedAt);
      }
    }
    if (dto.viberSuppressedAt !== undefined) {
      if (dto.viberSuppressedAt === null) {
        c.viberSuppressedAt = null;
      } else {
        c.viberSuppressedAt = new Date(dto.viberSuppressedAt);
      }
    }

    MarketingContactService.assertHasContactChannel(c.email, c.phoneE164);
    await this.ensureContactIdentifiersUnique(c.email, c.phoneE164, c.id);

    const saved = await this.marketingContactRepository.save(c);
    await this.infobipContactPush.pushIfPhonePresent(saved);
    return saved;
  }

  /**
   * Backfill from registered **customers only** (skips ADMIN; removes seller/affiliate rows linked by userId).
   */
  async backfillFromRegisteredUsers(dryRun: boolean): Promise<{
    scanned: number;
    customersSynced: number;
    skippedAdmin: number;
    skippedNonCustomers: number;
    dryRun: boolean;
  }> {
    const total = await this.userRepository.count();
    const batch = 250;
    let scanned = 0;
    let customersSynced = 0;
    let skippedAdmin = 0;
    let skippedNonCustomers = 0;

    for (let skip = 0; skip < total; skip += batch) {
      const users = await this.userRepository.find({
        skip,
        take: batch,
        order: { createdAt: 'ASC' },
        select: ['id', 'userType'],
      });

      for (const u of users) {
        scanned++;
        if (u.userType === UserType.ADMIN) {
          skippedAdmin++;
          continue;
        }
        if (u.userType !== UserType.CUSTOMER) {
          skippedNonCustomers++;
          if (!dryRun) {
            await this.marketingContactRepository.delete({ userId: u.id });
          }
          continue;
        }
        customersSynced++;
        if (!dryRun) {
          await this.marketingContactSyncService.upsertFromUserId(u.id);
        }
      }
    }

    return {
      scanned,
      customersSynced,
      skippedAdmin,
      skippedNonCustomers,
      dryRun,
    };
  }

  /**
   * Upsert one CSV row by email / phone merge. Imports default cold opt-out for marketing;
   * use overwriteConsents to opt-in imported leads still unlinked from a registered user account.
   */
  async upsertImportedRow(
    row: {
      email: string | null;
      phoneE164: string | null;
      name: string | null;
      gender?: string | null;
      city?: string | null;
      address?: string | null;
      tag?: string | null;
    },
    options: { overwriteConsents?: boolean },
  ): Promise<'created' | 'updated'> {
    const emailNorm =
      row.email && row.email.trim() !== ''
        ? row.email.trim().toLowerCase()
        : null;
    const phone = row.phoneE164;

    if (!emailNorm && !phone) {
      throw new BadRequestException(
        'Each row needs at least a valid email or phone number.',
      );
    }

    let contact: MarketingContact | null = null;
    if (emailNorm) {
      contact = await this.marketingContactRepository.findOne({
        where: { email: emailNorm },
      });
    }
    if (!contact && phone) {
      contact = await this.marketingContactRepository.findOne({
        where: { phoneE164: phone },
      });
    }

    const overwriteConsents = options.overwriteConsents === true;
    const isNew = !contact;

    const entity =
      contact ??
      this.marketingContactRepository.create({
        source: MarketingContactSource.IMPORT,
        emailMarketingOptIn: false,
        viberMarketingOptIn: false,
        metadata: { kind: 'csv_import' },
      });

    if (entity.userId) {
      if (overwriteConsents) {
        entity.emailMarketingOptIn = true;
        entity.emailSuppressedAt = null;
      }
      if (entity.name === null || entity.name === '')
        entity.name = row.name ?? entity.name;
      MarketingContactService.applyOptionalProfileFromImport(entity, row);

      entity.metadata = {
        ...(entity.metadata ?? {}),
        lastImportedAt: new Date().toISOString(),
      };
      const saved = await this.marketingContactRepository.save(entity);
      await this.infobipContactPush.pushIfPhonePresent(saved);
      return isNew ? 'created' : 'updated';
    }

    entity.email = emailNorm;
    entity.phoneE164 = phone;
    entity.name = row.name ?? entity.name ?? null;
    MarketingContactService.applyOptionalProfileFromImport(entity, row);

    if (overwriteConsents) {
      entity.emailMarketingOptIn = true;
      entity.emailSuppressedAt = null;
    }

    entity.metadata = {
      ...(entity.metadata ?? {}),
      ...(overwriteConsents ? { importOverwriteConsents: true } : {}),
      lastImportedAt: new Date().toISOString(),
    };

    entity.source = MarketingContactSource.IMPORT;

    const saved = await this.marketingContactRepository.save(entity);
    await this.infobipContactPush.pushIfPhonePresent(saved);
    return isNew ? 'created' : 'updated';
  }

  async classifyInfobipImportImpact(
    p: ParsedInfobipPerson,
  ): Promise<'would-create' | 'would-update' | 'skipped-no-contact-info'> {
    if (!p.phoneE164 && !p.emailNorm) return 'skipped-no-contact-info';

    const existing = await this.findMatchingMarketingContactForInfobipPerson(p);

    return existing ? 'would-update' : 'would-create';
  }

  /**
   * Merge one Infobip People profile into `marketing_contacts` (matched by Infobip id, then phone/e-mail).
   */
  async applyInfobipPersonImport(
    p: ParsedInfobipPerson,
    options?: { assumeViberOptIn?: boolean },
  ): Promise<'created' | 'updated' | 'skipped-no-contact-info'> {
    if (!p.phoneE164 && !p.emailNorm) return 'skipped-no-contact-info';

    const contact = await this.findMatchingMarketingContactForInfobipPerson(p);

    const isFresh = !contact;
    const entity =
      contact ??
      this.marketingContactRepository.create({
        source: MarketingContactSource.INFOBIP,
        emailMarketingOptIn: false,
        viberMarketingOptIn: false,
        metadata: { kind: 'infobip_import' },
      });

    const prevUserId = entity.userId;

    entity.metadata = {
      ...(entity.metadata ?? {}),
      infobipPersonId: p.infobipPersonId,
      ...(p.externalPersonId
        ? { infobipExternalPersonId: p.externalPersonId }
        : {}),
      infobipLastImportedAt: new Date().toISOString(),
    };

    /** Registered platform users — only enrich + tag with Infobip id; preserve consents */
    if (prevUserId) {
      if (!entity.phoneE164?.trim().length && p.phoneE164)
        entity.phoneE164 = p.phoneE164;
      if (!entity.email?.trim().length && p.emailNorm)
        entity.email = p.emailNorm;

      if (p.name && (!entity.name || !entity.name.trim())) entity.name = p.name;

      MarketingContactService.applyOptionalProfileFromImport(entity, {
        gender: p.gender,
        city: p.city,
        address: p.address,
      });

      await this.marketingContactRepository.save(entity);
      return isFresh ? 'created' : 'updated';
    }

    /** Cold audiences */
    entity.email = p.emailNorm ?? entity.email ?? null;
    entity.phoneE164 = p.phoneE164 ?? entity.phoneE164 ?? null;
    entity.name = p.name ?? entity.name ?? null;

    MarketingContactService.applyOptionalProfileFromImport(entity, {
      gender: p.gender,
      city: p.city,
      address: p.address,
    });

    if (options?.assumeViberOptIn === true && p.phoneE164) {
      entity.viberMarketingOptIn = true;
      entity.viberSuppressedAt = null;
    }

    if (isFresh) {
      entity.source = MarketingContactSource.INFOBIP;
    }

    await this.marketingContactRepository.save(entity);
    return isFresh ? 'created' : 'updated';
  }

  private async findMatchingMarketingContactForInfobipPerson(
    p: ParsedInfobipPerson,
  ): Promise<MarketingContact | null> {
    let c = await this.marketingContactRepository
      .createQueryBuilder('c')
      .where("(c.metadata->>'infobipPersonId') = :pid", {
        pid: p.infobipPersonId,
      })
      .getOne();

    if (c) return c;

    if (p.phoneE164) {
      c = await this.marketingContactRepository.findOne({
        where: { phoneE164: p.phoneE164 },
      });
      if (c) return c;
    }

    if (p.emailNorm) {
      c = await this.marketingContactRepository.findOne({
        where: { email: p.emailNorm },
      });
    }

    return c ?? null;
  }

  /**
   * Push contacts to Infobip People (Customer Profiles).
   *
   * - Skips contacts where `infobipPeopleSyncedAt IS NOT NULL` unless `forceResync=true`.
   * - Includes any contact with at least an email **or** a phone number.
   * - Orders by oldest-synced-first so unsynced contacts are always prioritised.
   */
  async pushAudienceSliceToInfobipPeople(
    limit: number,
    forceResync = false,
  ): Promise<{
    enabled: boolean;
    attempted: number;
    succeeded: number;
    failures: Array<{ id: string; error: string }>;
  }> {
    if (!this.infobipPeopleService.isConfigured()) {
      return { enabled: false, attempted: 0, succeeded: 0, failures: [] };
    }

    const take = Math.min(Math.max(limit, 1), 500);

    const qb = this.marketingContactRepository
      .createQueryBuilder('c')
      .where(
        '(TRIM(COALESCE(c."phoneE164", \'\')) <> \'\' OR TRIM(COALESCE(c.email, \'\')) <> \'\')',
      );

    if (!forceResync) {
      qb.andWhere('c."infobipPeopleSyncedAt" IS NULL');
    }

    const rows = await qb
      .orderBy('c."infobipPeopleSyncedAt"', 'ASC', 'NULLS FIRST')
      .addOrderBy('c."updatedAt"', 'DESC')
      .take(take)
      .getMany();

    const failures: Array<{ id: string; error: string }> = [];
    let succeeded = 0;

    for (const c of rows) {
      const r = await this.infobipPeopleService.upsertFromMarketingContact(c);
      if (r.ok) {
        succeeded++;
        await this.marketingContactRepository.update(c.id, {
          infobipPeopleSyncedAt: new Date(),
          infobipPeopleSyncError: null,
        });
      } else {
        failures.push({ id: c.id, error: r.error });
        await this.marketingContactRepository.update(c.id, {
          infobipPeopleSyncError: r.error.slice(0, 2000),
        });
      }
    }

    return {
      enabled: true,
      attempted: rows.length,
      succeeded,
      failures,
    };
  }

  /** Ensures no other row uses the same email (case-insensitive) or phone (E.164). */
  private async ensureContactIdentifiersUnique(
    emailNorm: string | null,
    phoneE164: string | null,
    excludeContactId?: string,
  ): Promise<void> {
    const email = emailNorm?.trim();
    if (email) {
      const qb = this.marketingContactRepository
        .createQueryBuilder('c')
        .where('LOWER(TRIM(c.email)) = LOWER(TRIM(:em))', { em: email });
      if (excludeContactId) {
        qb.andWhere('c.id != :cid', { cid: excludeContactId });
      }
      const hit = await qb.getOne();
      if (hit) {
        throw new ConflictException(
          'Another audience contact already uses this email.',
        );
      }
    }

    const phone = phoneE164?.trim();
    if (phone) {
      const qb = this.marketingContactRepository
        .createQueryBuilder('c')
        .where('c.phoneE164 = :ph', { ph: phone });
      if (excludeContactId) {
        qb.andWhere('c.id != :cid', { cid: excludeContactId });
      }
      const hit = await qb.getOne();
      if (hit) {
        throw new ConflictException(
          'Another audience contact already uses this phone number.',
        );
      }
    }
  }

  private static assertHasContactChannel(
    email: string | null | undefined,
    phoneE164: string | null | undefined,
  ): void {
    const em = email?.trim();
    const ph = phoneE164?.trim();
    if (!em && !ph) {
      throw new BadRequestException(
        'Provide at least an email or a valid phone number.',
      );
    }
  }

  private static applyOptionalProfileFromImport(
    entity: MarketingContact,
    row: {
      gender?: string | null;
      city?: string | null;
      address?: string | null;
      tag?: string | null;
    },
  ): void {
    const g = normalizeMarketingGenderInput(row.gender);
    if (g) entity.gender = g;
    if (row.city != null && String(row.city).trim()) {
      entity.city = String(row.city).trim().slice(0, 256);
    }
    if (row.address != null && String(row.address).trim()) {
      entity.address = String(row.address).trim().slice(0, 2000);
    }
    if (row.tag != null && String(row.tag).trim()) {
      entity.tag = String(row.tag).trim().slice(0, 128);
    }
  }
}
