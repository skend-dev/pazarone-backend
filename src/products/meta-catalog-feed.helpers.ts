import { Product, ProductStatus } from './entities/product.entity';

function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 100);
}

export function generateProductSlug(name: string, id: string): string {
  return `${slugify(name)}-${id}`;
}

export function metaFeedStripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseProductImages(images: unknown): string[] {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images.filter(
      (x): x is string => typeof x === 'string' && x.trim() !== '',
    );
  }
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images) as unknown;
      if (Array.isArray(parsed)) {
        return parseProductImages(parsed);
      }
      if (images.startsWith('http')) return [images];
    } catch {
      if (images.includes(',')) {
        return images
          .split(',')
          .map((u) => u.trim())
          .filter(Boolean);
      }
      if (images.trim()) return [images.trim()];
    }
  }
  return [];
}

export function getFirstProductImage(
  images: unknown,
  placeholder = '/placeholder.svg',
): string {
  const arr = parseProductImages(images);
  return arr[0]?.trim() || placeholder;
}

export function metaFeedAbsolutizeUrl(url: string, siteOrigin: string): string {
  const origin = siteOrigin.replace(/\/$/, '');
  if (!url || url === '/placeholder.svg') return `${origin}/og-image.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${origin}${url}`;
  return `${origin}/${url}`;
}

/** Effective unit price (sale if active, else regular/base/legacy). */
export function metaFeedUnitPrice(product: Product): number {
  const sale = product.salePrice != null ? Number(product.salePrice) : null;
  const expires = product.salePriceExpiresAt;
  const saleActive =
    sale != null && (!expires || new Date(expires) > new Date());
  if (saleActive) return sale;
  const regular =
    product.regularPrice != null ? Number(product.regularPrice) : null;
  const base = product.basePrice != null ? Number(product.basePrice) : null;
  return regular ?? base ?? Number(product.price);
}

export function metaFeedPrice(product: Product): {
  amount: number;
  currency: string;
} {
  const currency = (product.baseCurrency as string) || 'MKD';
  const variants = product.variants ?? [];
  if (product.hasVariants && variants.length > 0) {
    const candidates: number[] = [];
    for (const v of variants) {
      if (!v.isActive || v.stock <= 0) continue;
      const p =
        v.price != null ? Number(v.price) : metaFeedUnitPrice(product);
      candidates.push(p);
    }
    if (candidates.length === 0) {
      return { amount: metaFeedUnitPrice(product), currency };
    }
    return { amount: Math.min(...candidates), currency };
  }
  return { amount: metaFeedUnitPrice(product), currency };
}

export function metaFeedAvailability(
  product: Product,
): 'in stock' | 'out of stock' {
  if (product.status === ProductStatus.INACTIVE) return 'out of stock';
  const variants = product.variants ?? [];
  if (product.hasVariants && variants.length > 0) {
    const ok = variants.some((v) => v.isActive && v.stock > 0);
    return ok ? 'in stock' : 'out of stock';
  }
  return product.stock > 0 ? 'in stock' : 'out of stock';
}

export function metaFeedProductLink(
  product: Product,
  siteOrigin: string,
  locale: string,
): string {
  const slug = generateProductSlug(product.name, product.id);
  const origin = siteOrigin.replace(/\/$/, '');
  return `${origin}/${locale}/product/${slug}`;
}

export function metaFeedProductImage(
  product: Product,
  siteOrigin: string,
): string {
  const raw = getFirstProductImage(product.images as unknown);
  return metaFeedAbsolutizeUrl(raw, siteOrigin);
}

export function formatMetaCatalogMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function productStoreName(product: Product): string {
  const seller = product.seller as { storeName?: string | null } | undefined;
  const name = seller?.storeName?.trim();
  return name || 'PazarOne';
}

export function productToMetaFeedItemXml(
  product: Product,
  siteOrigin: string,
  locale: string,
): string {
  const { amount, currency } = metaFeedPrice(product);
  const availability = metaFeedAvailability(product);
  const brand = productStoreName(product);
  const title = escapeXml(product.name.slice(0, 150));
  const description = escapeXml(
    metaFeedStripHtml(product.description || product.details || '').slice(
      0,
      9999,
    ),
  );
  const link = escapeXml(metaFeedProductLink(product, siteOrigin, locale));
  const imageLink = escapeXml(metaFeedProductImage(product, siteOrigin));
  const price = escapeXml(formatMetaCatalogMoney(amount, currency));

  return `
    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:availability>${availability}</g:availability>
      <g:condition>new</g:condition>
      <g:price>${price}</g:price>
      <g:link>${link}</g:link>
      <g:image_link>${imageLink}</g:image_link>
      <g:brand>${escapeXml(brand.slice(0, 100))}</g:brand>
    </item>`;
}

export function productToMetaFeedItemJson(
  product: Product,
  siteOrigin: string,
  locale: string,
) {
  const { amount, currency } = metaFeedPrice(product);
  const brand = productStoreName(product);
  return {
    id: product.id,
    title: product.name,
    description: metaFeedStripHtml(
      product.description || product.details || '',
    ).slice(0, 9999),
    availability: metaFeedAvailability(product),
    condition: 'new',
    price: formatMetaCatalogMoney(amount, currency),
    link: metaFeedProductLink(product, siteOrigin, locale),
    image_link: metaFeedProductImage(product, siteOrigin),
    brand,
  };
}

export function buildMetaProductFeedXml(
  products: Product[],
  siteOrigin: string,
  locale: string,
): string {
  const channelTitle = escapeXml('PazarOne Catalog');
  const channelLink = escapeXml(siteOrigin.replace(/\/$/, ''));
  const items = products
    .map((p) => productToMetaFeedItemXml(p, siteOrigin, locale))
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${channelTitle}</title>
    <link>${channelLink}</link>
    <description>PazarOne product catalog for Meta</description>
    ${items}
  </channel>
</rss>`;
}
