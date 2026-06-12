import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  IMPORT_ALLOWED_EXTENSIONS,
  IMPORT_MAX_CATEGORY_LABEL_LENGTH,
  IMPORT_MAX_CATEGORY_MAPPINGS,
  IMPORT_MAX_CELL_LENGTH,
  IMPORT_MAX_COLUMNS,
  IMPORT_MAX_FILE_SIZE,
  IMPORT_MAX_IMAGE_URL_LENGTH,
  IMPORT_MAX_NAME_LENGTH,
  IMPORT_MAX_PRICE,
  IMPORT_MAX_ROWS,
  IMPORT_MAX_SKU_LENGTH,
  IMPORT_MAX_STOCK,
} from './import-security.constants';

export type ImportFileKind = 'csv';

export function sanitizeImportFilename(filename: string): string {
  const cleaned = (filename || 'import.csv')
    .replace(/\0/g, '')
    .replace(/[/\\]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 255);
  return cleaned || 'import.csv';
}

export function getImportFileExtension(filename: string): string {
  const safe = sanitizeImportFilename(filename).toLowerCase();
  const dot = safe.lastIndexOf('.');
  if (dot <= 0) return '';
  return safe.slice(dot);
}

export function detectImportFileKind(
  buffer: Buffer,
  filename: string,
): ImportFileKind {
  const ext = getImportFileExtension(filename);
  if (!IMPORT_ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException('Only CSV files (.csv) are allowed.');
  }

  if (buffer.length < 2) {
    throw new BadRequestException('File is empty or too small.');
  }

  const isZip =
    buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  const isOle =
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;

  if (isZip || isOle) {
    throw new BadRequestException(
      'File is not a valid CSV. Export as CSV from WooCommerce or Shopify.',
    );
  }

  if (buffer.includes(0)) {
    throw new BadRequestException('CSV file contains invalid binary data.');
  }

  return 'csv';
}

export function assertImportFileBuffer(buffer: Buffer, filename: string): ImportFileKind {
  if (!buffer?.length) {
    throw new BadRequestException('File is empty.');
  }
  if (buffer.length > IMPORT_MAX_FILE_SIZE) {
    throw new BadRequestException(
      `File exceeds maximum size of ${IMPORT_MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    );
  }
  return detectImportFileKind(buffer, filename);
}

export function assertImportRowLimits(
  headers: string[],
  rows: Record<string, string>[],
): void {
  if (headers.length > IMPORT_MAX_COLUMNS) {
    throw new BadRequestException(
      `File has too many columns (max ${IMPORT_MAX_COLUMNS}).`,
    );
  }
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new BadRequestException(
      `File has too many rows (max ${IMPORT_MAX_ROWS}). Split into smaller exports.`,
    );
  }
}

export function sanitizeImportText(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (value == null) return undefined;
  let s = String(value)
    .replace(/\0/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = s.trim();
  if (!s) return undefined;

  while (/^[=+\-@\t\r]/.test(s)) {
    s = s.slice(1).trimStart();
  }

  if (s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  return s || undefined;
}

export function sanitizeImportCellValue(value: string): string {
  const sanitized = sanitizeImportText(value, IMPORT_MAX_CELL_LENGTH);
  return sanitized ?? '';
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split('.').map((n) => parseInt(n, 10));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  if (
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('::ffff:127.')
  ) {
    return true;
  }

  return false;
}

export function isSafeExternalImageUrl(url: string): boolean {
  if (!url?.trim() || url.length > IMPORT_MAX_IMAGE_URL_LENGTH) {
    return false;
  }
  try {
    const u = new URL(normalizeExternalImageUrl(url.trim()));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return false;
    }
    if (u.username || u.password) {
      return false;
    }
    if (isPrivateOrLocalHost(u.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function normalizeExternalImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function sanitizeImportSku(sku: string | undefined): string | undefined {
  if (!sku) return undefined;
  const cleaned = sku
    .replace(/\0/g, '')
    .replace(/[^\w.\-+/]/g, '')
    .trim()
    .slice(0, IMPORT_MAX_SKU_LENGTH);
  return cleaned || undefined;
}

export function sanitizeImportCategoryLabel(
  label: string | undefined,
): string | undefined {
  return sanitizeImportText(label, IMPORT_MAX_CATEGORY_LABEL_LENGTH);
}

export function clampImportStock(stock: number | undefined): number {
  if (stock == null || !Number.isFinite(stock) || stock < 0) return 0;
  return Math.min(Math.floor(stock), IMPORT_MAX_STOCK);
}

export function clampImportPrice(price: number | undefined): number | undefined {
  if (price == null || !Number.isFinite(price) || price < 0) {
    return undefined;
  }
  if (price > IMPORT_MAX_PRICE) {
    return IMPORT_MAX_PRICE;
  }
  return price;
}

export function assertValidCategoryMappings(
  mappings?: Record<string, string>,
): void {
  if (!mappings) return;
  const entries = Object.entries(mappings);
  if (entries.length > IMPORT_MAX_CATEGORY_MAPPINGS) {
    throw new BadRequestException(
      `Too many category mappings (max ${IMPORT_MAX_CATEGORY_MAPPINGS}).`,
    );
  }
  for (const [label, categoryId] of entries) {
    if (!sanitizeImportCategoryLabel(label)) {
      throw new BadRequestException('Invalid category mapping label.');
    }
    if (!isUUID(categoryId, '4')) {
      throw new BadRequestException(
        `Invalid category ID for mapping "${label}".`,
      );
    }
  }
}

export function sanitizeNormalizedRows(
  rows: Record<string, string>[],
): Record<string, string>[] {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const safeKey = sanitizeImportText(key, 200) ?? 'column';
      out[safeKey] = sanitizeImportCellValue(value);
    }
    return out;
  });
}
