/** Split a JSON array element that stored several URLs as one comma-separated string. */
export function splitConcatenatedImageUrls(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/,(?=https?:\/\/)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Meta Commerce Manager accepts JPEG or PNG only (not WebP, AVIF, GIF, SVG, …). */
const META_CATALOG_ALLOWED_EXT = /\.(jpe?g|png)(\?|$)/i;
const META_CATALOG_UNSUPPORTED_EXT =
  /\.(webp|avif|gif|svg|bmp|tiff?|heic|heif)(\?|$)/i;

export function isMetaCatalogJpegOrPngUrl(url: string): boolean {
  if (!url?.trim()) return false;
  const path = url.split('?')[0].toLowerCase();
  if (META_CATALOG_UNSUPPORTED_EXT.test(path)) return false;
  if (path.includes('cloudinary.com')) {
    return (
      path.includes('/f_jpg/') ||
      path.includes('f_jpg/') ||
      path.includes('%2f_jpg') ||
      META_CATALOG_ALLOWED_EXT.test(path)
    );
  }
  return META_CATALOG_ALLOWED_EXT.test(path);
}

/** Cloudinary serves JPEG when the URL extension is .jpg for the same public ID. */
export function rewriteCloudinaryWebpToJpg(url: string): string {
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }
  return url.replace(/\.(webp|avif)(\?|$)/gi, '.jpg$2');
}

/**
 * Cloudinary path after /image/upload/, skipping any existing transform segments.
 * e.g. f_jpg,q_auto:good,.../v123/id.jpg → v123/id.jpg
 */
export function cloudinaryAssetPathAfterUpload(url: string): string | null {
  const marker = '/image/upload/';
  const index = url.indexOf(marker);
  if (index === -1) return null;

  let rest = url.slice(index + marker.length).split('?')[0];
  while (rest.length > 0 && !/^v\d+\//.test(rest)) {
    const slash = rest.indexOf('/');
    if (slash === -1) return null;
    rest = rest.slice(slash + 1);
  }
  return rest || null;
}

/** Slash-only transform — no commas or %2C (Meta splits image_link on literal commas). */
const META_SAFE_JPEG_TRANSFORM = 'w_1000/h_1000/c_fill/f_jpg';

/**
 * Meta-safe Cloudinary JPEG URL (no commas).
 * Always uses a slash transform prefix so Commerce Manager sees a new URL and
 * re-fetches after prior failed webp or comma-truncated ingests.
 */
export function cloudinaryJpegForMetaCatalog(url: string): string {
  if (!url?.includes('cloudinary.com')) {
    return url;
  }

  const marker = '/image/upload/';
  const index = url.indexOf(marker);
  if (index === -1) {
    return rewriteCloudinaryWebpToJpg(url);
  }

  const assetPath = cloudinaryAssetPathAfterUpload(url);
  if (!assetPath) {
    return rewriteCloudinaryWebpToJpg(url);
  }

  const base = url.slice(0, index + marker.length);
  const jpgPath = assetPath.replace(/\.(webp|avif|png)$/i, '.jpg');
  const normalized = url.split('?')[0];

  if (normalized.includes(`${marker}${META_SAFE_JPEG_TRANSFORM}/`)) {
    return normalized;
  }

  return `${base}${META_SAFE_JPEG_TRANSFORM}/${jpgPath}`;
}

/**
 * Absolute JPEG/PNG URL for Meta catalog `image_link`.
 * Cloudinary assets are forced to JPEG via f_jpg; other hosts must already be .jpg/.jpeg/.png.
 */
export function ensureMetaCatalogImageUrl(
  url: string,
  siteOrigin: string,
): string {
  const origin = siteOrigin.replace(/\/$/, '');
  const fallback = `${origin}/og-image.png`;
  const trimmed = url?.trim() ?? '';

  if (!trimmed || trimmed === '/placeholder.svg') {
    return fallback;
  }

  let absolute = trimmed;
  if (trimmed.startsWith('//')) {
    absolute = `https:${trimmed}`;
  } else if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    absolute = `${origin}${trimmed}`;
  } else if (!/^https?:\/\//i.test(trimmed)) {
    absolute = `${origin}/${trimmed.replace(/^\//, '')}`;
  }

  if (absolute.includes('cloudinary.com')) {
    return cloudinaryJpegForMetaCatalog(absolute);
  }

  const bare = absolute.split('?')[0];
  if (META_CATALOG_UNSUPPORTED_EXT.test(bare)) {
    return fallback;
  }
  if (META_CATALOG_ALLOWED_EXT.test(bare)) {
    return bare;
  }

  return fallback;
}

/** Ordered catalog image URLs derived from a product's stored images. */
export function metaCatalogImageCandidates(
  images: unknown,
  siteOrigin: string,
): string[] {
  const origin = siteOrigin.replace(/\/$/, '');
  const urls: string[] = [];

  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    for (const part of splitConcatenatedImageUrls(value)) {
      urls.push(ensureMetaCatalogImageUrl(part, origin));
    }
  };

  if (!images) return urls;
  if (Array.isArray(images)) {
    for (const item of images) push(item);
    return urls;
  }
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) push(item);
        return urls;
      }
    } catch {
      /* fall through */
    }
    push(images);
  }
  return urls;
}

export function rewriteProductImageUrls(
  images: string[] | null | undefined,
): string[] | null {
  if (!images) {
    return images ?? null;
  }
  if (!Array.isArray(images)) {
    return images;
  }
  return images.flatMap((url) => {
    if (typeof url !== 'string') {
      return [url];
    }
    return splitConcatenatedImageUrls(url).map(rewriteCloudinaryWebpToJpg);
  });
}
