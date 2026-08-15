/** Cloudinary serves JPEG when the URL extension is .jpg for the same public ID. */
export function rewriteCloudinaryWebpToJpg(url: string): string {
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }
  return url.replace(/\.webp(\?|$)/gi, '.jpg$1');
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
  return images.map((url) =>
    typeof url === 'string' ? rewriteCloudinaryWebpToJpg(url) : url,
  );
}
