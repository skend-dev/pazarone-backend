import { ParsedInfobipPerson } from './infobip-person.types';
import { normalizePhoneToE164 } from './utils/phone-normalize';

type JsonObj = Record<string, unknown>;

/**
 * Loose parsing for Infobip People list + person payloads ([Customer Profiles](https://www.infobip.com/docs/api/customer-engagement/people)).
 * Responses differ slightly by API version/host.
 */

export function infobipListExtractRecords(root: Record<string, unknown>): unknown[] {
  for (const k of [
    'persons',
    'people',
    'data',
    'items',
    'results',
    'content',
    'records',
  ]) {
    const v = root[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

export function infobipListHasMore(
  root: Record<string, unknown>,
  pageSizeReturned: number,
  requestedLimit: number,
): boolean {
  if (pageSizeReturned <= 0) return false;

  const totalPages = numberish(root.totalPages ?? root.pages ?? root.pageCount);
  const currentPage = numberish(root.page ?? root.number ?? root.pageNumber);
  if (
    typeof totalPages === 'number' &&
    typeof currentPage === 'number' &&
    totalPages >= 1
  ) {
    return currentPage < totalPages;
  }

  const totalCount = numberish(root.total ?? root.totalCount ?? root.totalRecords ?? root.totalElements);
  const sz =
    numberish(root.size ?? root.limit ?? root.pageSize) ?? requestedLimit;
  const cur = currentPage ?? numberish(root.number);
  if (typeof totalCount === 'number' && typeof sz === 'number' && typeof cur === 'number') {
    const fetchedSoFar = (cur - 1) * sz + pageSizeReturned;
    return fetchedSoFar < totalCount;
  }

  /** No reliable total — heuristic */
  return pageSizeReturned >= requestedLimit;
}

function numberish(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/** Contact info blobs from various Infobip shapes */
function coerceContactSlices(r: JsonObj): unknown[] {
  for (const k of [
    'contactInformation',
    'contact_information',
    'contacts',
    'phoneNumbers',
    'communications',
    'channels',
  ]) {
    const v = r[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function stringifyId(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function collectStringsFromContacts(
  arr: unknown[],
): { phonesDigits: string[]; emailsNorm: string[] } {
  const phonesDigits: string[] = [];
  const emailsNorm: string[] = [];

  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw as JsonObj;

    const ch = String(
      c.channel ?? c.type ?? c.kind ?? '',
    ).toUpperCase();

    let phoneRaw =
      typeof c.phoneNumber === 'string' ? c.phoneNumber : '';
    let detailPhone = '';

    const detail = c.detail;
    if (detail && typeof detail === 'object') {
      const d = detail as JsonObj;
      if (typeof d.phoneNumber === 'string') detailPhone = d.phoneNumber;
    }

    const val =
      c.value ??
      c.address ??
      c.email ??
      detailPhone ??
      phoneRaw ??
      '';

    const s = typeof val === 'string' ? val.trim() : '';
    if (!s) continue;

    if (/EMAIL/i.test(ch) || s.includes('@')) {
      emailsNorm.push(s.toLowerCase());
      continue;
    }

    /** SMS / PHONE / VIBER / MOBILE / empty channel with digits → treat as phone */
    const digits = s.replace(/[^\d+]/g, '');
    const hasDigit = /\d/.test(digits);
    if (
      hasDigit &&
      (/SMS|PHONE|MOBILE|CELL|VIBER|WHATS|WA\b/.test(ch) || !ch.length)
    ) {
      phonesDigits.push(digits.startsWith('+') ? digits.slice(1) : digits.replace(/^\+/, ''));
    }
  }

  return { phonesDigits, emailsNorm };
}

function bestE164FromDigitCandidates(candidates: string[]): string | null {
  const seen = new Set<string>();
  for (const digits of candidates) {
    const d = digits.replace(/\D/g, '');
    if (d.length < 8 || seen.has(d)) continue;
    seen.add(d);

    let e164 = normalizePhoneToE164(`+${d}`);
    if (!e164) e164 = normalizePhoneToE164(d);
    if (e164) return e164;
  }
  return null;
}

function buildName(raw: JsonObj): string | null {
  const first = stringifyId(raw.firstName ?? raw.first_name);
  const last = stringifyId(raw.lastName ?? raw.last_name);

  const nickname = stringifyId(raw.nickname ?? raw.nick_name);
  const full =
    stringifyId(raw.fullName ?? raw.full_name ?? raw.displayName ?? raw.display_name);

  if (full?.length && full.toLowerCase() !== 'noname' && full !== '-') {
    return full.slice(0, 512);
  }

  if (nickname?.length && nickname.toLowerCase() !== 'noname') {
    return nickname.slice(0, 512);
  }

  if (first && last && last !== '—') {
    const n = `${first} ${last}`.trim().slice(0, 512);
    if (n.length) return n;
  }
  if (first?.length && first !== 'Audience') return first.slice(0, 512);
  if (last?.length && last !== '—') return last.slice(0, 512);

  return null;
}

/**
 * Parses one person object returned from Infobip People APIs.
 */
export function parseInfobipPerson(raw: unknown): ParsedInfobipPerson | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as JsonObj;

  const infobipPersonId =
    stringifyId(
      r.personId ??
        r.id ??
        r.guid ??
        r.uuid ??
        r.personGuid ??
        r.person_id,
    ) ?? '';

  if (!infobipPersonId) return null;

  const contacts = coerceContactSlices(r);
  const { phonesDigits, emailsNorm } = collectStringsFromContacts(contacts);
  const phoneE164 = bestE164FromDigitCandidates(phonesDigits);

  let emailNorm: string | null = null;
  for (const e of emailsNorm) {
    const t = e.trim().toLowerCase();
    if (t.includes('@')) {
      emailNorm = t;
      break;
    }
  }

  if (!phoneE164 && !emailNorm) return null;

  const externalPersonId =
    stringifyId(r.externalPersonId ?? r.external_person_id) ?? null;

  const demographics = (
    typeof r.demographics === 'object' &&
    r.demographics !== null
      ? (r.demographics as JsonObj)
      : null
  ) ?? r;

  const gender = stringifyId(
    demographics?.gender ?? r.gender,
  )?.slice(0, 64) ?? null;

  const city =
    stringifyId(
      demographics?.city ?? demographics?.town ?? r.city,
    )?.slice(0, 256) ?? null;

  const address =
    stringifyId(
      demographics?.address ?? demographics?.street ?? r.address,
    )?.slice(0, 2000) ?? null;

  return {
    infobipPersonId,
    externalPersonId,
    emailNorm,
    phoneE164,
    name: buildName(r),
    gender,
    city,
    address,
  };
}
