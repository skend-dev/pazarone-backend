import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketingContact } from './entities/marketing-contact.entity';

/** Optional sync of marketing contacts → Infobip People ([Customer Profiles](https://www.infobip.com/docs/api/customer-engagement/people)). Paths vary by tenant; tune env if needed. */
const FETCH_TIMEOUT_MS = 25_000;

@Injectable()
export class InfobipPeopleService {
  private readonly logger = new Logger(InfobipPeopleService.name);

  constructor(private readonly configService: ConfigService) {}

  /** When true and BASE + KEY exist, PUT to upsert-path with externalPersonId (contact id). */
  isConfigured(): boolean {
    if (
      this.configService.get<string>('INFOBIP_PEOPLE_SYNC_ENABLED')?.trim()
        ?.toLowerCase() !== 'true'
    ) {
      return false;
    }
    const base =
      this.configService.get<string>('INFOBIP_PEOPLE_BASE_URL')?.trim() ?? '';
    const key =
      this.configService.get<string>('INFOBIP_PEOPLE_API_KEY')?.trim() ??
      this.configService.get<string>('INFOBIP_VIBER_API_KEY')?.trim() ??
      '';
    return base.length > 0 && key.length > 0;
  }

  /**
   * PUT `{base}{path}/{externalPersonId}` with a conservative payload.
   * Default path `/people/2/persons` — adjust via `INFOBIP_PEOPLE_UPSERT_PATH` for your tenant.
   */
  async upsertFromMarketingContact(
    contact: MarketingContact,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Infobip People sync disabled or not configured' };
    }

    const baseRaw =
      this.configService.get<string>('INFOBIP_PEOPLE_BASE_URL')?.trim() ?? '';
    const path =
      this.configService.get<string>('INFOBIP_PEOPLE_UPSERT_PATH')?.trim() ||
      '/people/2/persons';
    const apiKey =
      this.configService.get<string>('INFOBIP_PEOPLE_API_KEY')?.trim() ??
      this.configService.get<string>('INFOBIP_VIBER_API_KEY')?.trim() ??
      '';

    const base = InfobipPeopleService.normalizeBaseUrl(baseRaw);
    const url = `${base}${path.replace(/\/+$/, '')}/${encodeURIComponent(contact.id)}`;

    const { firstName, lastName } = InfobipPeopleService.splitName(contact.name);
    const body: Record<string, unknown> = {
      type: 'CUSTOMER',
      externalPersonId: contact.id,
      firstName: InfobipPeopleService.sanitizePersonField(firstName),
      lastName: InfobipPeopleService.sanitizePersonField(lastName),
    };

    const contactInformation: Array<Record<string, string>> = [];
    if (contact.phoneE164?.trim()) {
      const digits = contact.phoneE164.replace(/^\+/, '').replace(/\D/g, '');
      if (digits) {
        contactInformation.push({ channel: 'SMS', value: digits });
      }
    }
    if (contact.email?.trim()) {
      contactInformation.push({
        channel: 'EMAIL',
        value: contact.email.trim().toLowerCase(),
      });
    }
    if (contactInformation.length) {
      body.contactInformation = contactInformation;
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `App ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        const err = `Infobip People HTTP ${res.status}: ${text.slice(0, 400)}`;
        this.logger.warn(err);
        return { ok: false, error: err };
      }

      this.logger.debug(`Infobip People upsert OK for marketing contact ${contact.id}`);
      return { ok: true };
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || /abort(ed)?|aborted\b/i.test(err.message));
      const msg = isAbort
        ? 'Infobip People request timed out'
        : err instanceof Error
          ? err.message
          : String(err);
      return { ok: false, error: msg };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Infobip disallows characters in profile name fields — strip aggressively. */
  static sanitizePersonField(s: string): string {
    return s.replace(/[&<>"'/\\:{}\[\]=;#\n\r()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  static splitName(name: string | null | undefined): {
    firstName: string;
    lastName: string;
  } {
    const n = name?.trim() ?? '';
    if (!n) return { firstName: 'Audience', lastName: 'Contact' };
    const sp = n.indexOf(' ');
    if (sp === -1) return { firstName: n.slice(0, 80), lastName: '—' };
    return {
      firstName: n.slice(0, sp).slice(0, 80) || 'Audience',
      lastName: n.slice(sp + 1).trim().slice(0, 80) || '—',
    };
  }

  static normalizeBaseUrl(raw: string): string {
    let u = raw.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(u)) {
      u = `https://${u}`;
    }
    return u;
  }

  private inboundCredentials(): { base: string; key: string } | null {
    const basePeople =
      this.configService.get<string>('INFOBIP_PEOPLE_BASE_URL')?.trim() ??
      '';
    const baseViber =
      this.configService.get<string>('INFOBIP_VIBER_BASE_URL')?.trim() ??
      '';
    const baseRaw = basePeople || baseViber;
    const key =
      this.configService.get<string>('INFOBIP_PEOPLE_API_KEY')?.trim() ??
      this.configService.get<string>('INFOBIP_VIBER_API_KEY')?.trim() ??
      '';
    if (!baseRaw || !key) return null;
    return { base: InfobipPeopleService.normalizeBaseUrl(baseRaw), key };
  }

  /**
   * List/fetch Persons (import into PazarOne). Requires base URL + API key (People or shared Viber key).
   */
  isInboundImportReady(): boolean {
    return this.inboundCredentials() !== null;
  }

  /**
   * GET one page from Infobip People (`INFOBIP_PEOPLE_LIST_PATH`, default `/people/2/persons`).
   * Tune `INFOBIP_PEOPLE_LIST_PAGE_QUERY`, `LIMIT` query keys, `INFOBIP_PEOPLE_LIST_PAGE_ZERO_INDEXED=true` if needed.
   */
  async fetchPersonsJsonPage(
    page: number,
    limit: number,
  ): Promise<Record<string, unknown>> {
    const creds = this.inboundCredentials();
    if (!creds) {
      throw new Error(
        'Infobip list API requires INFOBIP_PEOPLE_BASE_URL (or INFOBIP_VIBER_BASE_URL) and API key.',
      );
    }

    const listPathRaw =
      this.configService.get<string>('INFOBIP_PEOPLE_LIST_PATH')?.trim() ||
      '/people/2/persons';
    const path = listPathRaw.startsWith('/')
      ? listPathRaw
      : `/${listPathRaw}`;

    const pageQuery =
      this.configService.get<string>('INFOBIP_PEOPLE_LIST_PAGE_QUERY')?.trim() ||
      'page';
    const limitQuery =
      this.configService.get<string>('INFOBIP_PEOPLE_LIST_LIMIT_QUERY')
        ?.trim() ||
      'limit';

    const pageZeroIndexed =
      this.configService.get<string>('INFOBIP_PEOPLE_LIST_PAGE_ZERO_INDEXED')
        ?.toLowerCase() === 'true';
    const pageValue = pageZeroIndexed ? Math.max(0, page - 1) : page;

    const qs = new URLSearchParams({
      [pageQuery]: String(pageValue),
      [limitQuery]: String(limit),
    });

    const url = `${creds.base.replace(/\/+$/, '')}${path}?${qs.toString()}`;
    const listTimeoutMs = Number(
      this.configService.get<string>('INFOBIP_PEOPLE_LIST_TIMEOUT_MS') ?? '60000',
    );

    const ac = new AbortController();
    const timer = setTimeout(
      () => ac.abort(),
      Math.min(Math.max(listTimeoutMs, 5_000), 120_000),
    );

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `App ${creds.key}`,
          Accept: 'application/json',
        },
        signal: ac.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(
          `Infobip People LIST HTTP ${res.status} ${text.slice(0, 380)}`,
        );
        throw new Error(
          `Infobip People list failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }
      return text.trim()
        ? (JSON.parse(text) as Record<string, unknown>)
        : {};
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || /abort(ed)?|aborted\b/i.test(err.message));
      if (isAbort) throw new Error('Infobip People list request timed out');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
