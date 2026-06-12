import { ImportRowStatus } from './types';

export type DuplicateMatchField = 'sku' | 'name' | 'image';

export interface ExistingProductIndex {
  bySku: Map<string, string>;
  byName: Map<string, string>;
  byPrimaryImage: Map<string, string>;
}

export interface ExistingProductRecord {
  id: string;
  sku: string | null;
  name: string;
  images: string[] | null;
}

export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeImageUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/$/, '');
}

export function buildExistingProductIndex(
  products: ExistingProductRecord[],
): ExistingProductIndex {
  const bySku = new Map<string, string>();
  const byName = new Map<string, string>();
  const byPrimaryImage = new Map<string, string>();

  for (const product of products) {
    if (product.sku) {
      const skuKey = product.sku.toLowerCase();
      if (!bySku.has(skuKey)) bySku.set(skuKey, product.id);
    }

    const nameKey = normalizeProductName(product.name);
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, product.id);
    }

    const firstImage = product.images?.[0];
    if (firstImage) {
      const imageKey = normalizeImageUrl(firstImage);
      if (imageKey && !byPrimaryImage.has(imageKey)) {
        byPrimaryImage.set(imageKey, product.id);
      }
    }
  }

  return { bySku, byName, byPrimaryImage };
}

export interface DuplicateMatch {
  productId: string;
  field: DuplicateMatchField;
  messageRef: string;
}

export function findExistingProductMatch(
  candidate: { sku?: string; name: string; images?: string[] },
  index: ExistingProductIndex,
): DuplicateMatch | null {
  if (candidate.sku) {
    const productId = index.bySku.get(candidate.sku.toLowerCase());
    if (productId) {
      return {
        productId,
        field: 'sku',
        messageRef: `SKU "${candidate.sku}"`,
      };
    }
  }

  const firstImage = candidate.images?.[0];
  if (firstImage) {
    const productId = index.byPrimaryImage.get(normalizeImageUrl(firstImage));
    if (productId) {
      return {
        productId,
        field: 'image',
        messageRef: 'matching primary image',
      };
    }
  }

  const nameKey = normalizeProductName(candidate.name);
  const productId = index.byName.get(nameKey);
  if (productId) {
    return {
      productId,
      field: 'name',
      messageRef: `name "${candidate.name}"`,
    };
  }

  return null;
}

export function resolveDuplicateRow(
  duplicateMode: 'skip' | 'update',
  match: DuplicateMatch,
): {
  status: ImportRowStatus;
  message: string;
  existingProductId: string;
} {
  const subject =
    match.field === 'name'
      ? `Product with ${match.messageRef}`
      : `Product with ${match.messageRef}`;

  if (duplicateMode === 'skip') {
    return {
      status: 'duplicate_skip',
      message: `${subject} already exists`,
      existingProductId: match.productId,
    };
  }

  return {
    status: 'duplicate_update',
    message: `${subject} will be updated`,
    existingProductId: match.productId,
  };
}
