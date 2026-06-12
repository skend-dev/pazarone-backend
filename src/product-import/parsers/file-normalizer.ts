import { parse } from 'csv-parse/sync';
import { BadRequestException } from '@nestjs/common';
import { ImportSourceFormat } from './types';
import {
  assertImportFileBuffer,
  assertImportRowLimits,
  sanitizeImportFilename,
  sanitizeNormalizedRows,
} from './import-security';

export interface NormalizedFile {
  format: ImportSourceFormat;
  headers: string[];
  rows: Record<string, string>[];
}

const WC_HEADERS = ['type', 'name', 'regular price', 'images', 'categories'];
const SHOPIFY_HEADERS = ['handle', 'title', 'variant sku', 'variant price', 'image src'];

function detectFormat(headers: string[]): ImportSourceFormat {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const wcScore = WC_HEADERS.filter((h) => lower.includes(h)).length;
  const shopifyScore = SHOPIFY_HEADERS.filter((h) => lower.includes(h)).length;
  if (shopifyScore > wcScore) return 'shopify';
  return 'woocommerce';
}

function rowsFromCsvBuffer(buffer: Buffer): {
  headers: string[];
  rows: Record<string, string>[];
} {
  try {
    const records = parse(buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      max_record_size: 1024 * 1024,
    }) as Record<string, string>[];

    if (!records.length) {
      throw new BadRequestException('File has no data rows.');
    }

    const headers = Object.keys(records[0]);
    return { headers, rows: records };
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException(
      'Could not parse CSV. Use UTF-8 with a header row.',
    );
  }
}

export function normalizeImportFile(
  buffer: Buffer,
  filename: string,
): NormalizedFile {
  const safeFilename = sanitizeImportFilename(filename);
  assertImportFileBuffer(buffer, safeFilename);

  const { headers, rows } = rowsFromCsvBuffer(buffer);

  if (!rows.length) {
    throw new BadRequestException('File has no data rows.');
  }

  assertImportRowLimits(headers, rows);
  const sanitizedRows = sanitizeNormalizedRows(rows);
  const trimmedHeaders = headers.map((h) => h.trim());

  const format = detectFormat(trimmedHeaders);
  return { format, headers: trimmedHeaders, rows: sanitizedRows };
}
