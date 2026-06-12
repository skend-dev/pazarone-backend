import { validateImportRowImages } from './import-image-validation';
import * as imageUrlCheck from './image-url-check';

jest.mock('./image-url-check', () => ({
  checkImageUrl: jest.fn(),
}));

describe('import-image-validation', () => {
  const checkImageUrl = imageUrlCheck.checkImageUrl as jest.Mock;

  beforeEach(() => {
    checkImageUrl.mockReset();
  });

  it('skips rows when every image URL is unreachable', async () => {
    checkImageUrl.mockResolvedValue({ ok: false, status: 404 });

    const result = await validateImportRowImages({
      line: 2,
      status: 'ready',
      name: 'Test product',
      images: [
        'https://babymert.com/wp-content/uploads/2026/06/missing.png',
      ],
    });

    expect(result.status).toBe('skipped_no_images');
    expect(result.message).toContain('404');
    expect(result.images).toEqual([]);
  });

  it('keeps reachable images and drops dead URLs', async () => {
    checkImageUrl.mockImplementation(async (url: string) => {
      if (url.includes('good.jpg')) {
        return { ok: true, status: 200 };
      }
      return { ok: false, status: 404 };
    });

    const result = await validateImportRowImages({
      line: 3,
      status: 'ready',
      name: 'Test product',
      images: [
        'https://babymert.com/wp-content/uploads/2026/06/missing.png',
        'https://babymert.com/wp-content/uploads/2026/06/good.jpg',
      ],
    });

    expect(result.status).toBe('ready');
    expect(result.images).toEqual([
      'https://babymert.com/wp-content/uploads/2026/06/good.jpg',
    ]);
    expect(result.message).toContain('unreachable');
  });
});
