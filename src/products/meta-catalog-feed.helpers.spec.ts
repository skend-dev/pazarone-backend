import {
  metaCatalogProductImageUrl,
  metaFeedProductImage,
} from './meta-catalog-feed.helpers';
import { Product } from './entities/product.entity';

describe('meta-catalog-feed.helpers image URLs', () => {
  const origin = 'https://www.pazarone.co';
  const productId = '18a2252e-9b6e-4195-8b86-f99bc0d7b0b4';

  it('metaCatalogProductImageUrl uses same-domain proxy path', () => {
    expect(metaCatalogProductImageUrl(productId, origin)).toBe(
      `${origin}/api/meta-product-image/${productId}.jpg?v=3`,
    );
  });

  it('metaFeedProductImage points to same-domain proxy for product id', () => {
    const product = {
      id: productId,
      images: [
        'https://res.cloudinary.com/demo/image/upload/v1/products/x.webp',
      ],
    } as Product;

    expect(metaFeedProductImage(product, origin)).toBe(
      `${origin}/api/meta-product-image/${productId}.jpg?v=3`,
    );
    expect(metaFeedProductImage(product, origin)).not.toContain('cloudinary.com');
  });
});
