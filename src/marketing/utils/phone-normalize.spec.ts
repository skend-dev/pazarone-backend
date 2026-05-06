import { normalizePhoneToE164 } from './phone-normalize';

describe('normalizePhoneToE164', () => {
  it('returns null for empty input', () => {
    expect(normalizePhoneToE164(null)).toBeNull();
    expect(normalizePhoneToE164(undefined)).toBeNull();
    expect(normalizePhoneToE164('')).toBeNull();
    expect(normalizePhoneToE164('   ')).toBeNull();
  });

  it('normalizes North Macedonia local mobiles', () => {
    const result = normalizePhoneToE164('076 123 456');
    expect(result).toMatch(/^\+389/);
  });

  it('accepts already international strings', () => {
    expect(normalizePhoneToE164('+38970123456')).toBe('+38970123456');
  });
});
