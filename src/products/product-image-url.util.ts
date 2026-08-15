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

const META_JPEG_TRANSFORM = 'f_jpg,q_auto:good,c_pad,w_1000,h_1000,b_white';

/**
 * Force a JPEG that meets Meta catalog size rules (min 500×500).
 * Inserts Cloudinary transforms after /image/upload/.
 */
export function cloudinaryJpegForMetaCatalog(url: string): string {
  const jpeg = rewriteCloudinaryWebpToJpg(url);
  const marker = '/image/upload/';
  const index = jpeg.indexOf(marker);
  if (index === -1 || !jpeg.includes('cloudinary.com')) {
    return jpeg;
  }
  const after = jpeg.slice(index + marker.length);
  if (after.startsWith(`${META_JPEG_TRANSFORM}/`)) {
    return jpeg;
  }
  return `${jpeg.slice(0, index + marker.length)}${META_JPEG_TRANSFORM}/${after}`;
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
