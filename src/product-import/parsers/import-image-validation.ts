import { normalizeExternalImageUrl } from './import-security';
import { checkImageUrl } from './image-url-check';
import { ParsedImportRow } from './types';

const ROW_VALIDATION_CONCURRENCY = 5;
const URL_CHECK_CONCURRENCY = 6;

export async function filterReachableImageUrls(urls: string[]): Promise<{
  reachable: string[];
  unreachable: Array<{ url: string; status: number | null }>;
  inconclusive: string[];
}> {
  const unique = [
    ...new Set(urls.map((url) => normalizeExternalImageUrl(url)).filter(Boolean)),
  ];
  const reachable: string[] = [];
  const unreachable: Array<{ url: string; status: number | null }> = [];
  const inconclusive: string[] = [];

  for (let i = 0; i < unique.length; i += URL_CHECK_CONCURRENCY) {
    const chunk = unique.slice(i, i + URL_CHECK_CONCURRENCY);
    const checks = await Promise.all(
      chunk.map(async (url) => ({
        url,
        check: await checkImageUrl(url),
      })),
    );

    for (const { url, check } of checks) {
      if (check.ok) {
        reachable.push(url);
      } else if (check.inconclusive) {
        inconclusive.push(url);
        reachable.push(url);
      } else {
        unreachable.push({ url, status: check.status });
      }
    }
  }

  return { reachable, unreachable, inconclusive };
}

export async function validateImportRowImages(
  row: ParsedImportRow,
): Promise<ParsedImportRow> {
  if (!row.images?.length) {
    return row;
  }

  if (!['ready', 'duplicate_update'].includes(row.status)) {
    return row;
  }

  const { reachable, unreachable } = await filterReachableImageUrls(row.images);

  if (reachable.length === 0) {
    const firstStatus = unreachable[0]?.status;
    const statusLabel =
      firstStatus != null ? `HTTP ${firstStatus}` : 'network error';
    return {
      ...row,
      status: 'skipped_no_images',
      message: `Image URLs not reachable (${statusLabel})`,
      images: [],
    };
  }

  if (unreachable.length === 0) {
    return { ...row, images: reachable };
  }

  const removedNote = `${unreachable.length} unreachable image URL(s) removed`;
  return {
    ...row,
    images: reachable,
    message: row.message ? `${row.message}; ${removedNote}` : removedNote,
  };
}

export async function validateImportRowsImages(
  rows: ParsedImportRow[],
  onProgress?: (current: number, total: number) => void,
): Promise<ParsedImportRow[]> {
  const validated: ParsedImportRow[] = [];

  for (let i = 0; i < rows.length; i += ROW_VALIDATION_CONCURRENCY) {
    const batch = rows.slice(i, i + ROW_VALIDATION_CONCURRENCY);
    const results = await Promise.all(batch.map(validateImportRowImages));
    validated.push(...results);
    onProgress?.(validated.length, rows.length);
  }

  return validated;
}
