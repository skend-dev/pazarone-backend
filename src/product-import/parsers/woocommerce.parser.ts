import {
  ImportRowStatus,
  ParsedImportRow,
} from './types';
import {
  normalizeWooType,
  parseCategoryLabel,
  parseImageList,
  parsePrice,
  parseStock,
  stripHtml,
  VALID_WOO_TYPES,
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

export function parseWooCommerceRows(
  rows: Record<string, string>[],
  options: {
    importUnpublished: boolean;
    existingProducts: ExistingProductIndex;
    duplicateMode: 'skip' | 'update';
  },
): ParsedImportRow[] {
  const results: ParsedImportRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    const type = normalizeWooType(get(row, 'Type'));
    const name = get(row, 'Name').trim();

    if (!type || !VALID_WOO_TYPES.has(type)) {
      if (!name && !type) {
        results.push({
          line,
          status: 'skipped_malformed',
          message: 'Empty or continuation row',
        });
        continue;
      }
      results.push({
        line,
        status: 'skipped_malformed',
        message: `Unrecognized product type: ${type || '(empty)'}`,
        name: name || undefined,
      });
      continue;
    }

    if (type === 'variable' || type === 'variation') {
      results.push({
        line,
        status: 'skipped_variant',
        message: 'Variable products and variations are not supported in v1',
        name: name || undefined,
      });
      continue;
    }

    if (type !== 'simple') {
      results.push({
        line,
        status: 'skipped_malformed',
        message: `Product type "${type}" is not supported`,
        name: name || undefined,
      });
      continue;
    }

    if (!name) {
      results.push({
        line,
        status: 'skipped_malformed',
        message: 'Missing product name',
      });
      continue;
    }

    const published = get(row, 'Published').trim();
    const isPublished = published !== '0' && published.toLowerCase() !== 'no';
    if (!isPublished && !options.importUnpublished) {
      results.push({
        line,
        status: 'skipped_unpublished',
        name,
        message: 'Product is not published',
      });
      continue;
    }

    const descriptionHtml = get(row, 'Description');
    const shortDesc = get(row, 'Short description');
    const images = parseImageList(get(row, 'Images'), descriptionHtml);

    if (!images.length) {
      results.push({
        line,
        status: 'skipped_no_images',
        name,
        message: 'No valid image URLs found',
      });
      continue;
    }

    const regularPrice = clampImportPrice(parsePrice(get(row, 'Regular price')));
    const salePrice = clampImportPrice(parsePrice(get(row, 'Sale price')));
    if (regularPrice === undefined && salePrice === undefined) {
      results.push({
        line,
        status: 'skipped_no_price',
        name,
        message: 'Missing regular or sale price',
      });
      continue;
    }

    const sku = sanitizeImportSku(get(row, 'SKU').trim() || undefined);

    const saleEnds = get(row, 'Date sale price ends').trim();

    const safeName = sanitizeImportText(name, IMPORT_MAX_NAME_LENGTH);
    if (!safeName) {
      results.push({
        line,
        status: 'skipped_malformed',
        message: 'Invalid product name',
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
        sanitizeImportText(stripHtml(descriptionHtml) || safeName, 10_000) ||
        safeName,
      details: sanitizeImportText(stripHtml(shortDesc), 10_000),
      regularPrice: regularPrice ?? salePrice,
      salePrice:
        salePrice !== undefined && regularPrice !== undefined && salePrice < regularPrice
          ? salePrice
          : undefined,
      salePriceExpiresAt: saleEnds || undefined,
      stock: clampImportStock(
        parseStock(get(row, 'Stock'), get(row, 'In stock?')),
      ),
      sku,
      images,
      categoryLabel: sanitizeImportCategoryLabel(
        parseCategoryLabel(get(row, 'Categories')),
      ),
      published: isPublished,
    });
  }

  return results;
}
