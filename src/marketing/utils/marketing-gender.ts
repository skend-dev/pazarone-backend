/** Stored on `marketing_contacts.gender` and used in filters / broadcasts. */
export const MARKETING_CANONICAL_GENDERS = ['male', 'female'] as const;
export type MarketingCanonicalGender =
  (typeof MARKETING_CANONICAL_GENDERS)[number];

/**
 * Maps unknown strings (CSV, legacy Infobip, etc.) to canonical values or null.
 */
export function normalizeMarketingGenderInput(
  raw: string | null | undefined,
): MarketingCanonicalGender | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (!t) return null;
  if (t === 'male' || t === 'm' || t === 'man') return 'male';
  if (
    t === 'female' ||
    t === 'f' ||
    t === 'woman' ||
    t === 'girl' ||
    t === 'w'
  ) {
    return 'female';
  }
  if (t.includes('female') || t.includes('woman')) return 'female';
  if (t.includes('male')) return 'male';
  return null;
}
