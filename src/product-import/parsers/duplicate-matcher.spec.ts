import {
  buildExistingProductIndex,
  findExistingProductMatch,
  normalizeImageUrl,
  normalizeProductName,
  resolveDuplicateRow,
} from './duplicate-matcher';

describe('duplicate-matcher', () => {
  const index = buildExistingProductIndex([
    {
      id: 'p1',
      sku: 'ABC-1',
      name: 'Blue Chair',
      images: ['https://shop.example/a.jpg'],
    },
    {
      id: 'p2',
      sku: null,
      name: 'Бебешки Кревети Breezy Glow',
      images: [
        'https://babymert.com/wp-content/uploads/2025/10/478955993_1211094154351967_753795486416001427_n.jpg',
      ],
    },
  ]);

  it('normalizes product names', () => {
    expect(normalizeProductName('  Hello   World  ')).toBe('hello world');
  });

  it('normalizes image URLs', () => {
    expect(normalizeImageUrl('https://Example.com/a.jpg/')).toBe(
      'https://example.com/a.jpg',
    );
  });

  it('matches by SKU first', () => {
    const match = findExistingProductMatch(
      { sku: 'abc-1', name: 'Other', images: ['https://other.test/x.jpg'] },
      index,
    );
    expect(match?.productId).toBe('p1');
    expect(match?.field).toBe('sku');
  });

  it('matches by primary image when SKU is missing', () => {
    const match = findExistingProductMatch(
      {
        name: 'Different name',
        images: [
          'https://babymert.com/wp-content/uploads/2025/10/478955993_1211094154351967_753795486416001427_n.jpg',
        ],
      },
      index,
    );
    expect(match?.productId).toBe('p2');
    expect(match?.field).toBe('image');
  });

  it('matches by name when SKU and image do not match', () => {
    const match = findExistingProductMatch(
      {
        name: 'Бебешки Кревети Breezy Glow',
        images: ['https://new-image.test/only.jpg'],
      },
      index,
    );
    expect(match?.productId).toBe('p2');
    expect(match?.field).toBe('name');
  });

  it('returns skip and update statuses', () => {
    const match = findExistingProductMatch(
      { name: 'Blue Chair', images: [] },
      index,
    );
    expect(match).not.toBeNull();
    expect(resolveDuplicateRow('skip', match!).status).toBe('duplicate_skip');
    expect(resolveDuplicateRow('update', match!).status).toBe('duplicate_update');
  });
});
