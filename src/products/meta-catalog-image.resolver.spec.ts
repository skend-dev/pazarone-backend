import { pickReachableMetaCatalogImageUrl } from './meta-catalog-image.resolver';

describe('meta-catalog-image.resolver', () => {
  const origin = 'https://www.pazarone.co';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the first reachable candidate', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        headers: { get: () => null },
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'image/jpeg' },
      } as Response);

    const url = await pickReachableMetaCatalogImageUrl(
      [
        'https://res.cloudinary.com/demo/image/upload/v1/products/missing.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1/products/ok.jpg',
      ],
      origin,
    );

    expect(url).toContain('/products/ok.jpg');
    expect(url).toContain('f_jpg');
  });

  it('falls back to og-image.png when no product image is reachable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      headers: { get: () => null },
    } as Response);

    const url = await pickReachableMetaCatalogImageUrl(
      ['https://res.cloudinary.com/demo/image/upload/v1/products/missing.jpg'],
      origin,
    );

    expect(url).toBe(`${origin}/og-image.png`);
  });
});
