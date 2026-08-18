/** Split a JSON array element that stored several URLs as one comma-separated string. */
export function splitConcatenatedImageUrls(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/,(?=https?:\/\/)/i)
    .map((part) => part.trim())
    .filter(Boolean);
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

/** Slash-separated transforms only — Meta catalog parsers split image_link on commas. */
const META_SAFE_JPEG_TRANSFORM = 'w_1000/h_1000/c_pad/b_white/f_jpg';

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

  if (jpgPath.startsWith(`${META_SAFE_JPEG_TRANSFORM}/`)) {
    return `${base}${jpgPath}`;
  }

  return `${base}${META_SAFE_JPEG_TRANSFORM}/${jpgPath}`;
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
