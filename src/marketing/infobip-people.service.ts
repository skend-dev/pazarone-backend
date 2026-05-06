import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketingContact } from './entities/marketing-contact.entity';

/** Optional sync of marketing contacts → Infobip People ([Customer Profiles](https://www.infobip.com/docs/api/customer-engagement/people)). Paths vary by tenant; tune env if needed. */
const FETCH_TIMEOUT_MS = 25_000;

@Injectable()
export class InfobipPeopleService {
  private readonly logger = new Logger(InfobipPeopleService.name);

  constructor(private readonly configService: ConfigService) {}

  /** When true and BASE + KEY exist, POST/PATCH to People Customer Profiles upsert-path. */
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
   * Upsert marketing contact → Infobip People (`externalPersonId` = `contact.id`).
   *
   * Strategy (per portal docs):
   *   1. POST `/people/2/persons` to create.
   *   2. If Infobip returns 400 with errorCode **40004** (phone exists) or **40005** (email exists),
   *      search for the owning person and PATCH them to claim our `externalPersonId` + names.
   *
   * Docs: https://www.infobip.com/docs/api/customer-engagement/people/person-profile/create-a-new-person
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
    const pathNorm = path.replace(/\/+$/, '');

    const { firstName, lastName } = InfobipPeopleService.splitName(contact.name);

    // ── Custom attributes ─────────────────────────────────────────────────────
    const customAttributes: Record<string, string> = {};
    if (contact.tag?.trim()) {
      customAttributes.tag = InfobipPeopleService.sanitizePersonField(contact.tag.trim());
    }

    // city / address / country are top-level fields on the Infobip person object
    const profilePatch: Record<string, unknown> = {
      externalPersonId: contact.id,
      firstName: InfobipPeopleService.sanitizePersonField(firstName),
      lastName: InfobipPeopleService.sanitizePersonField(lastName),
      ...(contact.city?.trim()
        ? { city: InfobipPeopleService.sanitizePersonField(contact.city.trim()) }
        : {}),
      ...(contact.address?.trim()
        ? { address: InfobipPeopleService.sanitizePersonField(contact.address.trim()) }
        : {}),
      ...(contact.market?.trim()
        ? { country: InfobipPeopleService.sanitizePersonField(contact.market.trim().toUpperCase()) }
        : {}),
      ...(Object.keys(customAttributes).length ? { customAttributes } : {}),
    };

    const contactInformation: Record<string, Array<Record<string, string>>> = {};
    if (contact.email?.trim()) {
      contactInformation.email = [{ address: contact.email.trim().toLowerCase() }];
    }
    if (contact.phoneE164?.trim()) {
      const e164 = InfobipPeopleService.normalizeOutboundPhoneE164(contact.phoneE164);
      if (e164) contactInformation.phone = [{ number: e164 }];
    }

    const createBody: Record<string, unknown> = {
      ...profilePatch,
      ...(Object.keys(contactInformation).length
        ? { contactInformation }
        : {}),
    };

    // ── Step 1: POST to create ───────────────────────────────────────────────
    const createResult = await this.fetchJson(
      `${base}${pathNorm}`,
      'POST',
      apiKey,
      createBody,
    );

    if (createResult.ok) {
      this.logger.debug(`Infobip People created contact ${contact.id}`);
      return { ok: true };
    }

    // ── Step 2: Handle duplicates — find existing person and PATCH ───────────
    const dupEmail = createResult.errorCode === 40005;
    const dupPhone = createResult.errorCode === 40004;

    if (dupEmail || dupPhone) {
      this.logger.debug(
        `Infobip People conflict (${createResult.errorCode}) for ${contact.id} — resolving existing person`,
      );
      return this.patchExistingByContactInfo(
        base, pathNorm, apiKey, contact, profilePatch, dupEmail, dupPhone,
      );
    }

    // ── Other errors ─────────────────────────────────────────────────────────
    const errMsg = `Infobip People HTTP ${createResult.status}: ${createResult.raw.slice(0, 400)}`;
    this.logger.warn(errMsg);
    return { ok: false, error: errMsg };
  }

  /**
   * When a contact's email/phone already belongs to another Infobip person, search by that
   * attribute to retrieve the Infobip `personId`, then PATCH that person with our
   * `externalPersonId` and names so we can reference them later.
   */
  private async patchExistingByContactInfo(
    base: string,
    pathNorm: string,
    apiKey: string,
    contact: MarketingContact,
    namePatch: Record<string, unknown>,
    tryEmail: boolean,
    tryPhone: boolean,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const candidates: Array<{ param: string; value: string }> = [];

    if (tryEmail && contact.email?.trim()) {
      candidates.push({ param: 'email', value: contact.email.trim().toLowerCase() });
    }
    if (tryPhone && contact.phoneE164?.trim()) {
      const e164 = InfobipPeopleService.normalizeOutboundPhoneE164(contact.phoneE164);
      if (e164) candidates.push({ param: 'phoneNumber', value: e164 });
    }

    for (const { param, value } of candidates) {
      const searchUrl = `${base}${pathNorm}?${param}=${encodeURIComponent(value)}&page=1&limit=1`;
      const searchResult = await this.fetchJson(searchUrl, 'GET', apiKey);

      if (!searchResult.ok) continue;

      const personId = InfobipPeopleService.extractPersonIdFromList(
        searchResult.body,
      );
      if (!personId) continue;

      const patchResult = await this.fetchJson(
        `${base}${pathNorm}/${encodeURIComponent(personId)}`,
        'PATCH',
        apiKey,
        namePatch,
      );

      if (patchResult.ok) {
        this.logger.debug(
          `Infobip People patched existing person ${personId} → externalPersonId ${contact.id}`,
        );
        return { ok: true };
      }

      this.logger.warn(
        `Infobip People PATCH ${personId} HTTP ${patchResult.status}: ${patchResult.raw.slice(0, 200)}`,
      );
    }

    return {
      ok: false,
      error: `Infobip People duplicate conflict for contact ${contact.id} — could not resolve existing person`,
    };
  }

  /** Generic fetch helper that returns a typed result without throwing. */
  private async fetchJson(
    url: string,
    method: string,
    apiKey: string,
    body?: Record<string, unknown>,
  ): Promise<{
    ok: boolean;
    status: number;
    raw: string;
    body: Record<string, unknown>;
    errorCode: number | null;
  }> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `App ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: ac.signal,
      });
      const raw = await res.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { /* ignore */ }

      const errorCode =
        typeof parsed.errorCode === 'number' ? parsed.errorCode : null;

      return { ok: res.ok, status: res.status, raw, body: parsed, errorCode };
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || /abort(ed)?|aborted\b/i.test(err.message));
      const msg = isAbort ? 'timeout' : err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, raw: msg, body: {}, errorCode: null };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Extract the first Infobip personId from a list-style response. */
  private static extractPersonIdFromList(
    doc: Record<string, unknown>,
  ): string | null {
    const arr = (() => {
      for (const k of ['persons', 'people', 'data', 'items', 'results', 'content']) {
        const v = doc[k];
        if (Array.isArray(v) && v.length) return v;
      }
      return null;
    })();

    if (!arr) return null;
    const first = arr[0] as Record<string, unknown>;
    const id = first?.personId ?? first?.id ?? first?.guid ?? first?.uuid;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  }

  /** Infobip disallows characters in profile name fields — strip aggressively. */
  static sanitizePersonField(s: string): string {
    return s
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/[&<>"'/\\:{}\[\]=;#\n\r()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  /** E.164 with leading + for People SMS `contactInformation[].value`. */
  static normalizeOutboundPhoneE164(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  static splitName(name: string | null | undefined): {
    firstName: string;
    lastName: string;
  } {
    const n = name?.trim() ?? '';
    if (!n) return { firstName: 'Audience', lastName: 'Contact' };
    const sp = n.indexOf(' ');
    if (sp === -1) return { firstName: n.slice(0, 80), lastName: 'Contact' };
    return {
      firstName: n.slice(0, sp).slice(0, 80) || 'Audience',
      lastName: n.slice(sp + 1).trim().slice(0, 80) || 'Contact',
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
