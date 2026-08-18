import {
  metaCatalogImageCandidates,
  isMetaCatalogJpegOrPngUrl,
} from './product-image-url.util';

const META_CATALOG_FETCH_UA =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

export async function isMetaCatalogImageReachable(url: string): Promise<boolean> {
  if (!isMetaCatalogJpegOrPngUrl(url)) return false;
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': META_CATALOG_FETCH_UA,
        Accept: 'image/jpeg,image/png,*/*',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type') ?? '';
    return contentType.includes('image/jpeg') || contentType.includes('image/png');
  } catch {
    return false;
  }
}

export async function pickReachableMetaCatalogImageUrl(
  images: unknown,
  siteOrigin: string,
): Promise<string> {
  const origin = siteOrigin.replace(/\/$/, '');
  const fallback = `${origin}/og-image.png`;
  const seen = new Set<string>();
  const candidates = metaCatalogImageCandidates(images, origin).filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  for (const url of candidates) {
    if (await isMetaCatalogImageReachable(url)) {
      return url;
    }
  }

  if (await isMetaCatalogImageReachable(fallback)) {
    return fallback;
  }

  return fallback;
}

export async function resolveMetaCatalogImageLinks(
  products: Array<{ id: string; images: unknown }>,
  siteOrigin: string,
  concurrency = 40,
): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  for (let i = 0; i < products.length; i += concurrency) {
    const chunk = products.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (product) => {
        links.set(
          product.id,
          await pickReachableMetaCatalogImageUrl(product.images, siteOrigin),
        );
      }),
    );
  }
  return links;
}
