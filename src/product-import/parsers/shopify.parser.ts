import { ImportRowStatus, ParsedImportRow } from './types';
import {
  parseCategoryLabel,
  parseImageList,
  parsePrice,
  parseStock,
  stripHtml,
} from './utils';
import {
  clampImportPrice,
  clampImportStock,
  sanitizeImportCategoryLabel,
  sanitizeImportSku,
  sanitizeImportText,
} from './import-security';
import { IMPORT_MAX_NAME_LENGTH } from './import-security.constants';
import {
  ExistingProductIndex,
  findExistingProductMatch,
  resolveDuplicateRow,
} from './duplicate-matcher';

function get(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const found = Object.entries(row).find(
      ([k]) => k.toLowerCase().trim() === key.toLowerCase(),
    );
    if (found) return found[1] ?? '';
  }
  return '';
}

export function parseShopifyRows(
  rows: Record<string, string>[],
  options: {
    importUnpublished: boolean;
    existingProducts: ExistingProductIndex;
    duplicateMode: 'skip' | 'update';
  },
): ParsedImportRow[] {
  const byHandle = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const handle = get(row, 'Handle').trim().toLowerCase();
    if (!handle) continue;
    const list = byHandle.get(handle) || [];
    list.push(row);
    byHandle.set(handle, list);
  }

  const results: ParsedImportRow[] = [];
  let lineOffset = 2;

  for (const [, group] of byHandle) {
    const primary = group[0];
    const line = lineOffset;
    lineOffset += group.length;

    const title = get(primary, 'Title').trim();
    if (!title) {
      results.push({
        line,
        status: 'skipped_malformed',
        message: 'Missing product title',
      });
      continue;
    }

    const published = get(primary, 'Published').trim().toLowerCase();
    const isPublished = published === 'true' || published === 'yes' || published === '1';
    if (!isPublished && !options.importUnpublished) {
      results.push({
        line,
        status: 'skipped_unpublished',
        name: title,
        message: 'Product is not published',
      });
      continue;
    }

    const bodyHtml = get(primary, 'Body (HTML)');
    const allImages: string[] = [];
    for (const row of group) {
      const img = get(row, 'Image Src').trim();
      if (img) allImages.push(img);
    }
    const images = [...new Set([...allImages, ...parseImageList('', bodyHtml)])].slice(0, 8);

    if (!images.length) {
      results.push({
        line,
        status: 'skipped_no_images',
        name: title,
        message: 'No valid image URLs found',
      });
      continue;
    }

    const variantPrice = clampImportPrice(parsePrice(get(primary, 'Variant Price')));
    const compareAt = clampImportPrice(
      parsePrice(get(primary, 'Variant Compare At Price')),
    );
    let regularPrice = variantPrice;
    let salePrice: number | undefined;

    if (compareAt !== undefined && variantPrice !== undefined && compareAt > variantPrice) {
      regularPrice = compareAt;
      salePrice = variantPrice;
    } else if (variantPrice === undefined && compareAt !== undefined) {
      regularPrice = compareAt;
    }

    if (regularPrice === undefined && salePrice === undefined) {
      results.push({
        line,
        status: 'skipped_no_price',
        name: title,
        message: 'Missing variant price',
      });
      continue;
    }

    const sku = sanitizeImportSku(get(primary, 'Variant SKU').trim() || undefined);

    const qtyRaw = get(primary, 'Variant Inventory Qty');
    const stock = clampImportStock(
      qtyRaw.trim() ? parseStock(qtyRaw, undefined) : 0,
    );

    const safeName = sanitizeImportText(title, IMPORT_MAX_NAME_LENGTH);
    if (!safeName) {
      results.push({
        line,
        status: 'skipped_malformed',
        message: 'Invalid product title',
      });
      continue;
    }

    let status: ImportRowStatus = 'ready';
    let message: string | undefined;
    let existingProductId: string | undefined;

    const duplicateMatch = findExistingProductMatch(
      { sku, name: safeName, images },
      options.existingProducts,
    );
    if (duplicateMatch) {
      const resolved = resolveDuplicateRow(options.duplicateMode, duplicateMatch);
      status = resolved.status;
      message = resolved.message;
      existingProductId = resolved.existingProductId;
    }

    results.push({
      line,
      status,
      message,
      existingProductId,
      name: safeName,
      description:
        sanitizeImportText(stripHtml(bodyHtml) || safeName, 10_000) || safeName,
      details: undefined,
      regularPrice: regularPrice ?? salePrice,
      salePrice,
      stock,
      sku,
      images,
      categoryLabel: sanitizeImportCategoryLabel(
        parseCategoryLabel(get(primary, 'Product Category')) ||
          parseCategoryLabel(get(primary, 'Type')),
      ),
      published: isPublished,
    });
  }

  return results;
}
