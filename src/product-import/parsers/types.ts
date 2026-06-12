export type ImportSourceFormat = 'woocommerce' | 'shopify';

export type ImportRowStatus =
  | 'ready'
  | 'skipped_unpublished'
  | 'skipped_no_price'
  | 'skipped_no_images'
  | 'skipped_variant'
  | 'skipped_malformed'
  | 'duplicate_skip'
  | 'duplicate_update';

export interface ParsedImportRow {
  line: number;
  status: ImportRowStatus;
  message?: string;
  existingProductId?: string;
  name?: string;
  description?: string;
  details?: string;
  regularPrice?: number;
  salePrice?: number;
  salePriceExpiresAt?: string;
  stock?: number;
  sku?: string;
  images?: string[];
  categoryLabel?: string;
  published?: boolean;
}

export interface ImportPreviewResult {
  format: ImportSourceFormat;
  totalDataRows: number;
  readyToImport: number;
  skippedUnpublished: number;
  skippedNoPrice: number;
  skippedNoImages: number;
  skippedVariant: number;
  skippedMalformed: number;
  duplicateSkus: number;
  uniqueCategories: string[];
  suggestedCategoryMappings: Record<string, string>;
  sampleRows: ParsedImportRow[];
  errors: { line: number; message: string }[];
}

export interface ImportExecutionResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: {
    line: number;
    name: string;
    sku: string | null;
    status: 'created' | 'updated' | 'skipped' | 'failed';
    message?: string;
  }[];
}
