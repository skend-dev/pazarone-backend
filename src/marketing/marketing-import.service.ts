import { Injectable, BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { MarketingContactService } from './marketing-contact.service';
import { normalizePhoneToE164 } from './utils/phone-normalize';
import { normalizeMarketingGenderInput } from './utils/marketing-gender';

export interface MarketingCsvImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

export type MarketingCsvImportPreviewRowStatus =
  | 'ready'
  | 'no_channel'
  | 'bad_phone';

export interface MarketingCsvImportPreviewSampleRow {
  line: number;
  email: string | null;
  phoneE164: string | null;
  rawPhone: string | null;
  name: string | null;
  tag: string | null;
  status: MarketingCsvImportPreviewRowStatus;
}

export interface MarketingCsvImportPreview {
  totalDataRows: number;
  readyToImport: number;
  skippedNoChannel: number;
  phoneNormalizationFailed: number;
  sampleRows: MarketingCsvImportPreviewSampleRow[];
  errors: { line: number; message: string }[];
}

const PREVIEW_SAMPLE_LIMIT = 35;
const PREVIEW_ERROR_CAP = 120;

/** First non-empty column among common tag header names; normalized to max 128 chars. */
function tagFromCsvRow(row: Record<string, string>): string | null {
  const raw =
    row['tag'] ||
    row['tags'] ||
    row['label'] ||
    row['category'] ||
    row['segment'] ||
    '';
  const t = raw?.trim() ? raw.trim().slice(0, 128) : '';
  return t || null;
}

function parseMarketingCsvRows(buffer: Buffer): Record<string, string>[] {
  try {
    return parse(buffer.toString('utf8'), {
      columns: (header: string[]) =>
        header.map((cell) =>
          typeof cell === 'string' ? cell.trim().toLowerCase() : String(cell),
        ),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch {
    throw new BadRequestException(
      'Could not parse CSV. Use UTF-8 with a header row. Columns: email, phone, full name / name, gender (male/female), city, address, tag (all optional except need email or phone).',
    );
  }
}

@Injectable()
export class MarketingImportService {
  constructor(
    private readonly marketingContactService: MarketingContactService,
  ) {}

  /** Parse-only: validates structure and normalizes rows without writing to the database. */
  previewCsvBuffer(buffer: Buffer): MarketingCsvImportPreview {
    const rows = parseMarketingCsvRows(buffer);
    if (!rows.length) {
      throw new BadRequestException('CSV has no data rows.');
    }

    const preview: MarketingCsvImportPreview = {
      totalDataRows: rows.length,
      readyToImport: 0,
      skippedNoChannel: 0,
      phoneNormalizationFailed: 0,
      sampleRows: [],
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      const rawEmail = row['email'] || row['e-mail'] || row['mail'] || '';
      const rawPhone =
        row['phone'] || row['mobile'] || row['tel'] || row['telephone'] || '';
      const rawName =
        row['name'] ||
        row['fullname'] ||
        row['full name'] ||
        row['full_name'] ||
        '';

      const emailTrim = rawEmail?.trim() ? rawEmail.trim().toLowerCase() : '';

      let phoneE164: string | null = null;
      let status: MarketingCsvImportPreviewRowStatus = 'no_channel';
      const rawPhoneTrim = rawPhone?.trim() ? rawPhone.trim() : '';

      if (rawPhoneTrim) {
        phoneE164 = normalizePhoneToE164(rawPhone);
        if (!phoneE164) {
          preview.phoneNormalizationFailed++;
          status = 'bad_phone';
          const msg = `Could not normalize phone "${rawPhone}"`;
          if (preview.errors.length < PREVIEW_ERROR_CAP) {
            preview.errors.push({ line: lineNum, message: msg });
          }
        }
      }

      if (!emailTrim && !phoneE164) {
        if (status !== 'bad_phone') {
          preview.skippedNoChannel++;
          status = 'no_channel';
        }
      } else if (status !== 'bad_phone') {
        preview.readyToImport++;
        status = 'ready';
      }

      const nameClean = rawName?.trim() ? rawName.trim().slice(0, 512) : null;
      const tagClean = tagFromCsvRow(row);

      if (preview.sampleRows.length < PREVIEW_SAMPLE_LIMIT) {
        preview.sampleRows.push({
          line: lineNum,
          email: emailTrim || null,
          phoneE164,
          rawPhone: rawPhoneTrim || null,
          name: nameClean,
          tag: tagClean,
          status,
        });
      }
    }

    return preview;
  }

  async importCsvBuffer(
    buffer: Buffer,
    options: { overwriteConsents?: boolean },
  ): Promise<MarketingCsvImportSummary> {
    const summary: MarketingCsvImportSummary = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const rows = parseMarketingCsvRows(buffer);

    if (!rows.length) {
      throw new BadRequestException('CSV has no data rows.');
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      try {
        const rawEmail = row['email'] || row['e-mail'] || row['mail'] || '';
        const rawPhone =
          row['phone'] || row['mobile'] || row['tel'] || row['telephone'] || '';
        const rawName =
          row['name'] ||
          row['fullname'] ||
          row['full name'] ||
          row['full_name'] ||
          '';
        const rawGender = row['gender'] || row['sex'] || '';
        const rawCity = row['city'] || row['town'] || '';
        const rawAddress =
          row['address'] || row['street'] || row['location'] || '';

        const tagClean = tagFromCsvRow(row);

        const emailTrim = rawEmail?.trim() ? rawEmail.trim().toLowerCase() : '';

        let phoneE164: string | null = null;
        if (rawPhone?.trim()) {
          phoneE164 = normalizePhoneToE164(rawPhone);
          if (!phoneE164) {
            summary.skipped++;
            summary.errors.push({
              line: lineNum,
              message: `Could not normalize phone "${rawPhone}"`,
            });
            continue;
          }
        }

        if (!emailTrim && !phoneE164) {
          summary.skipped++;
          continue;
        }

        const nameClean = rawName?.trim() ? rawName.trim().slice(0, 512) : null;
        const genderClean = normalizeMarketingGenderInput(rawGender);
        const cityClean = rawCity?.trim() ? rawCity.trim().slice(0, 256) : null;
        const addressClean = rawAddress?.trim()
          ? rawAddress.trim().slice(0, 2000)
          : null;

        const result = await this.marketingContactService.upsertImportedRow(
          {
            email: emailTrim ? emailTrim : null,
            phoneE164,
            name: nameClean,
            gender: genderClean,
            city: cityClean,
            address: addressClean,
            tag: tagClean,
          },
          { overwriteConsents: options.overwriteConsents },
        );

        switch (result) {
          case 'created':
            summary.created++;
            break;
          case 'updated':
            summary.updated++;
            break;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ line: lineNum, message: msg });
      }
    }

    return summary;
  }
}
