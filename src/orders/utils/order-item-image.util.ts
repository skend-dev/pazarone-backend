import { OrderItem } from '../entities/order-item.entity';

/**
 * Featured image for an order line: variant image first, else first product image.
 */
export function getOrderItemFeaturedImageUrl(item: OrderItem): string | null {
  const variant = item.variant;
  if (variant?.images?.length) {
    return variant.images[0];
  }
  const imgs = item.product?.images;
  if (Array.isArray(imgs) && imgs.length > 0) {
    const first = imgs[0];
    if (typeof first === 'string') return first;
  }
  if (typeof imgs === 'string') {
    const s = imgs as string;
    if (s.startsWith('http')) return s;
  }
  return null;
}
