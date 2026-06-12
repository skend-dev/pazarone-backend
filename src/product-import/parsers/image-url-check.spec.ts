import { looksLikeImageBytes } from './image-url-check';

describe('image-url-check helpers', () => {
  it('detects jpeg magic bytes', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(looksLikeImageBytes(jpeg, '')).toBe(true);
  });

  it('detects image content-type', () => {
    expect(looksLikeImageBytes(new Uint8Array(0), 'image/jpeg')).toBe(true);
  });

  it('rejects html content-type without magic bytes', () => {
    expect(looksLikeImageBytes(new Uint8Array([0x3c, 0x68]), 'text/html')).toBe(
      false,
    );
  });
});
