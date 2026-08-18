import {
  cloudinaryAssetPathAfterUpload,
  cloudinaryJpegForMetaCatalog,
  ensureMetaCatalogImageUrl,
  isMetaCatalogJpegOrPngUrl,
  splitConcatenatedImageUrls,
} from './product-image-url.util';

describe('product-image-url.util', () => {
  const origin = 'https://www.pazarone.co';
  const plainJpg =
    'https://res.cloudinary.com/demo/image/upload/v1786670531/products/yb8iwymakqldkquwbjwr.jpg';
  const legacyCommaTransform =
    'https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto:good,c_pad,w_1000,h_1000,b_white/v1786670531/products/yb8iwymakqldkquwbjwr.jpg';
  const legacySlashTransform =
    'https://res.cloudinary.com/demo/image/upload/w_1000/h_1000/c_pad/b_white/f_jpg/v1786670531/products/yb8iwymakqldkquwbjwr.jpg';

  it('strips legacy transforms and emits exact 1000x1000 c_fill JPEG URL', () => {
    const out = cloudinaryJpegForMetaCatalog(legacySlashTransform);
    expect(out).toContain('c_fill,w_1000,h_1000,f_jpg/v1786670531/products/yb8iwymakqldkquwbjwr.jpg');
  });

  it('does not double-wrap an already Meta-safe URL', () => {
    const once = cloudinaryJpegForMetaCatalog(plainJpg);
    const twice = cloudinaryJpegForMetaCatalog(once);
    expect(twice).toBe(once);
  });

  it('rewrites webp/avif/png to jpg in the catalog path', () => {
    expect(
      cloudinaryJpegForMetaCatalog(
        'https://res.cloudinary.com/demo/image/upload/v1/products/x.webp',
      ),
    ).toContain('/products/x.jpg');
    expect(
      cloudinaryJpegForMetaCatalog(
        'https://res.cloudinary.com/demo/image/upload/v1/products/x.avif',
      ),
    ).toContain('/products/x.jpg');
    expect(
      cloudinaryJpegForMetaCatalog(
        'https://res.cloudinary.com/demo/image/upload/v1/products/x.png',
      ),
    ).toContain('/products/x.png'.replace('.png', '.jpg'));
  });

  it('ensureMetaCatalogImageUrl forces Cloudinary to JPEG delivery URL', () => {
    const out = ensureMetaCatalogImageUrl(plainJpg, origin);
    expect(out).toContain('f_jpg');
    expect(isMetaCatalogJpegOrPngUrl(out)).toBe(true);
  });

  it('ensureMetaCatalogImageUrl rejects unsupported third-party formats', () => {
    expect(
      ensureMetaCatalogImageUrl('https://cdn.example.com/photo.webp', origin),
    ).toBe(`${origin}/og-image.png`);
    expect(ensureMetaCatalogImageUrl('/placeholder.svg', origin)).toBe(
      `${origin}/og-image.png`,
    );
  });

  it('ensureMetaCatalogImageUrl keeps external JPEG and PNG URLs', () => {
    expect(
      ensureMetaCatalogImageUrl('https://cdn.example.com/photo.jpg', origin),
    ).toBe('https://cdn.example.com/photo.jpg');
    expect(
      ensureMetaCatalogImageUrl('https://cdn.example.com/photo.png?q=1', origin),
    ).toBe('https://cdn.example.com/photo.png');
  });

  it('extracts asset path after upload regardless of prior transforms', () => {
    expect(cloudinaryAssetPathAfterUpload(legacyCommaTransform)).toBe(
      'v1786670531/products/yb8iwymakqldkquwbjwr.jpg',
    );
    expect(cloudinaryAssetPathAfterUpload(plainJpg)).toBe(
      'v1786670531/products/yb8iwymakqldkquwbjwr.jpg',
    );
  });

  it('splits comma-joined image URL strings', () => {
    expect(
      splitConcatenatedImageUrls(
        'https://a.com/1.webp,https://a.com/2.jpg',
      ),
    ).toEqual(['https://a.com/1.webp', 'https://a.com/2.jpg']);
  });
});
