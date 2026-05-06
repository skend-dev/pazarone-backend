import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalizes Balkan-market phone strings to E.164 for messaging APIs (e.g. Viber).
 */
export function normalizePhoneToE164(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const tryMk = parsePhoneNumberFromString(trimmed, 'MK');
  if (tryMk?.isValid()) return tryMk.format('E.164');

  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed?.isValid()) return null;
  return parsed.format('E.164');
}
