import { isSafeExternalImageUrl, normalizeExternalImageUrl } from './import-security';

const IMG_SRC_REGEX =
  /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

export function stripHtml(html: string): string {
  if (!html?.trim()) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractImageUrlsFromHtml(html: string): string[] {
  if (!html?.trim()) return [];
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(IMG_SRC_REGEX.source, IMG_SRC_REGEX.flags);
  while ((match = re.exec(html)) !== null) {
    const url = match[1]?.trim();
    if (url && isSafeExternalImageUrl(url)) {
      urls.push(normalizeExternalImageUrl(url));
    }
  }
  return [...new Set(urls)];
}

export function parseImageList(raw: string, descriptionHtml?: string): string[] {
  const fromColumn = (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => isSafeExternalImageUrl(s))
    .map((s) => normalizeExternalImageUrl(s));

  const fromDesc = descriptionHtml
    ? extractImageUrlsFromHtml(descriptionHtml)
    : [];

  return [...new Set([...fromDesc, ...fromColumn])].slice(0, 8);
}

export function parsePrice(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : undefined;
}

export function parseStock(
  stockRaw: string | undefined,
  inStockRaw: string | undefined,
): number {
  if (stockRaw?.trim()) {
    const n = parseInt(stockRaw.trim(), 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  if (inStockRaw === '0' || inStockRaw?.toLowerCase() === 'no') return 0;
  if (inStockRaw === '1' || inStockRaw?.toLowerCase() === 'yes') return 1;
  return 0;
}

export function parseCategoryLabel(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : undefined;
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeWooType(type: string): string {
  return (type || '').trim().toLowerCase();
}

export const VALID_WOO_TYPES = new Set([
  'simple',
  'variable',
  'variation',
  'grouped',
  'external',
]);
