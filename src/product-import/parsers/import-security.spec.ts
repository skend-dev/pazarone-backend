import {
  assertImportFileBuffer,
  isSafeExternalImageUrl,
  sanitizeImportText,
  sanitizeImportSku,
} from './import-security';

describe('import-security', () => {
  it('strips spreadsheet formula injection prefixes', () => {
    expect(sanitizeImportText('=cmd|"/c calc"', 100)).toBe('cmd|"/c calc"');
    expect(sanitizeImportText('+HYPERLINK("http://evil")', 100)).toBe(
      'HYPERLINK("http://evil")',
    );
  });

  it('rejects private and local image URLs', () => {
    expect(isSafeExternalImageUrl('http://127.0.0.1/img.jpg')).toBe(false);
    expect(isSafeExternalImageUrl('http://localhost/img.jpg')).toBe(false);
    expect(isSafeExternalImageUrl('http://192.168.1.5/img.jpg')).toBe(false);
    expect(isSafeExternalImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalImageUrl('https://example.com/img.jpg')).toBe(true);
  });

  it('sanitizes SKU to safe characters', () => {
    expect(sanitizeImportSku('  BABY-01  ')).toBe('BABY-01');
    expect(sanitizeImportSku('bad"; DROP TABLE--')).toBe('badDROPTABLE--');
  });

  it('rejects binary content disguised as csv', () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(() => assertImportFileBuffer(buffer, 'evil.csv')).toThrow(
      /not a valid CSV/,
    );
  });
});
