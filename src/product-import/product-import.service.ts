import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { Product } from '../products/entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import {
  buildCategoryMappings,
  CategoryMatchCandidate,
  matchCategoryLabel,
} from './parsers/category-matcher';
import { assertValidCategoryMappings } from './parsers/import-security';
import { ProductsService } from '../products/products.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import {
  DuplicateImportMode,
  ProductImportOptionsDto,
} from './dto/product-import-options.dto';
import { normalizeImportFile } from './parsers/file-normalizer';
import { parseWooCommerceRows } from './parsers/woocommerce.parser';
import { parseShopifyRows } from './parsers/shopify.parser';
import {
  ImportExecutionResult,
  ImportPreviewResult,
  ImportRowStatus,
  ParsedImportRow,
} from './parsers/types';
import {
  ProductExternalImageStatus,
  ProductImageSource,
} from '../products/entities/product.entity';
import { UserType } from '../users/entities/user.entity';
import {
  buildExistingProductIndex,
  ExistingProductIndex,
} from './parsers/duplicate-matcher';
import { validateImportRowImages, validateImportRowsImages } from './parsers/import-image-validation';

const PREVIEW_SAMPLE_LIMIT = 25;
const PREVIEW_ERROR_CAP = 120;
const IMPORT_BATCH_SIZE = 10;

@Injectable()
export class ProductImportService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    private readonly productsService: ProductsService,
  ) {}

  async preview(
    buffer: Buffer,
    filename: string,
    sellerId: string,
    options?: Partial<ProductImportOptionsDto>,
  ): Promise<ImportPreviewResult> {
    await this.validateImportOptions(options);
    const normalized = normalizeImportFile(buffer, filename);
    const existingProducts = await this.loadExistingProductIndex(sellerId);
    const duplicateMode =
      options?.duplicateMode === DuplicateImportMode.UPDATE ? 'update' : 'skip';

    const parsed =
      normalized.format === 'shopify'
        ? parseShopifyRows(normalized.rows, {
            importUnpublished: !!options?.importUnpublished,
            existingProducts,
            duplicateMode,
          })
        : parseWooCommerceRows(normalized.rows, {
            importUnpublished: !!options?.importUnpublished,
            existingProducts,
            duplicateMode,
          });

    const validated = await validateImportRowsImages(parsed);
    const categories = await this.loadCategoryMatchCandidates();
    const preview = this.buildPreviewResult(
      normalized.format,
      validated,
      normalized.rows.length,
    );
    preview.suggestedCategoryMappings = buildCategoryMappings(
      preview.uniqueCategories,
      categories,
    );
    return preview;
  }

  async import(
    buffer: Buffer,
    filename: string,
    sellerId: string,
    options: ProductImportOptionsDto,
  ): Promise<ImportExecutionResult> {
    await this.validateImportOptions(options);
    const normalized = normalizeImportFile(buffer, filename);
    const existingProducts = await this.loadExistingProductIndex(sellerId);
    const duplicateMode =
      options.duplicateMode === DuplicateImportMode.UPDATE ? 'update' : 'skip';

    const parsed =
      normalized.format === 'shopify'
        ? parseShopifyRows(normalized.rows, {
            importUnpublished: !!options.importUnpublished,
            existingProducts,
            duplicateMode,
          })
        : parseWooCommerceRows(normalized.rows, {
            importUnpublished: !!options.importUnpublished,
            existingProducts,
            duplicateMode,
          });

    const validated = await validateImportRowsImages(parsed);
    const categories = await this.loadCategoryMatchCandidates();
    const importable = validated.filter((r) =>
      ['ready', 'duplicate_update'].includes(r.status),
    );

    const result: ImportExecutionResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      rows: [],
    };

    for (let i = 0; i < importable.length; i += IMPORT_BATCH_SIZE) {
      const batch = importable.slice(i, i + IMPORT_BATCH_SIZE);
      for (const row of batch) {
        try {
          const validatedRow = await validateImportRowImages(row);
          if (validatedRow.status === 'skipped_no_images') {
            result.skipped++;
            result.rows.push({
              line: validatedRow.line,
              name: validatedRow.name || '',
              sku: validatedRow.sku || null,
              status: 'skipped',
              message: validatedRow.message,
            });
            continue;
          }

          if (row.status === 'duplicate_update' && row.existingProductId) {
            const existing = await this.productsRepository.findOne({
              where: { id: row.existingProductId, sellerId },
            });
            if (existing) {
              const dto = this.rowToUpdateDto(validatedRow, options, categories);
              await this.productsService.update(
                existing.id,
                sellerId,
                dto,
                UserType.ADMIN,
              );
              await this.productsRepository.update(existing.id, {
                imageSource: ProductImageSource.EXTERNAL,
                externalImageStatus: ProductExternalImageStatus.HEALTHY,
                importSource: normalized.format,
                brokenImageUrls: null,
                externalImageIssueAt: null,
                externalImageResolvedAt: null,
              });
              result.updated++;
              result.rows.push({
                line: row.line,
                name: row.name || '',
                sku: row.sku || null,
                status: 'updated',
              });
              continue;
            }
          }

          const dto = this.rowToCreateDto(validatedRow, options, categories);
          const product = await this.productsService.createFromImport(
            sellerId,
            dto,
            {
              imageSource: ProductImageSource.EXTERNAL,
              externalImageStatus: ProductExternalImageStatus.HEALTHY,
              importSource: normalized.format,
            },
          );
          result.created++;
          result.rows.push({
            line: row.line,
            name: product.name,
            sku: product.sku,
            status: 'created',
          });
        } catch (err) {
          result.failed++;
          result.rows.push({
            line: row.line,
            name: row.name || '',
            sku: row.sku || null,
            status: 'failed',
            message:
              err instanceof Error ? err.message : 'Import failed for this row',
          });
        }
      }
    }

    const skippedStatuses: ImportRowStatus[] = [
      'skipped_unpublished',
      'skipped_no_price',
      'skipped_no_images',
      'skipped_variant',
      'skipped_malformed',
      'duplicate_skip',
    ];
    for (const row of validated) {
      if (skippedStatuses.includes(row.status)) {
        result.skipped++;
        result.rows.push({
          line: row.line,
          name: row.name || '',
          sku: row.sku || null,
          status: 'skipped',
          message: row.message,
        });
      }
    }

    return result;
  }

  private async loadExistingProductIndex(
    sellerId: string,
  ): Promise<ExistingProductIndex> {
    const products = await this.productsRepository.find({
      where: { sellerId },
      select: ['id', 'sku', 'name', 'images'],
    });
    return buildExistingProductIndex(products);
  }

  private async validateImportOptions(
    options?: Partial<ProductImportOptionsDto>,
  ): Promise<void> {
    if (!options) return;

    assertValidCategoryMappings(options.categoryMappings);

    if (
      options.defaultCategoryId &&
      !isUUID(options.defaultCategoryId, '4')
    ) {
      throw new BadRequestException('Invalid default category ID.');
    }

    const categoryIds = new Set<string>();
    if (options.defaultCategoryId) {
      categoryIds.add(options.defaultCategoryId);
    }
    if (options.categoryMappings) {
      for (const categoryId of Object.values(options.categoryMappings)) {
        categoryIds.add(categoryId);
      }
    }

    if (categoryIds.size === 0) return;

    const existing = await this.categoriesRepository.count({
      where: { id: In([...categoryIds]) },
    });
    if (existing !== categoryIds.size) {
      throw new BadRequestException(
        'One or more mapped category IDs do not exist.',
      );
    }
  }

  private async loadCategoryMatchCandidates(): Promise<CategoryMatchCandidate[]> {
    const categories = await this.categoriesRepository.find({
      select: ['id', 'name', 'slug', 'translations'],
      order: { name: 'ASC' },
    });
    return categories;
  }

  private resolveCategoryId(
    row: ParsedImportRow,
    options: ProductImportOptionsDto,
    categories: CategoryMatchCandidate[],
  ): string | undefined {
    if (row.categoryLabel && options.categoryMappings?.[row.categoryLabel]) {
      return options.categoryMappings[row.categoryLabel];
    }
    if (row.categoryLabel) {
      const auto = matchCategoryLabel(row.categoryLabel, categories);
      if (auto) return auto;
    }
    return options.defaultCategoryId;
  }

  private rowToCreateDto(
    row: ParsedImportRow,
    options: ProductImportOptionsDto,
    categories: CategoryMatchCandidate[],
  ): CreateProductDto {
    if (!row.name || !row.images?.length) {
      throw new BadRequestException('Row missing required fields');
    }
    const dto = new CreateProductDto();
    dto.name = row.name;
    dto.description = row.description || row.name;
    dto.details = row.details;
    dto.regularPrice = row.regularPrice;
    dto.salePrice = row.salePrice;
    dto.salePriceExpiresAt = row.salePriceExpiresAt;
    dto.stock = row.stock ?? 0;
    dto.sku = row.sku;
    dto.images = row.images;
    dto.categoryId = this.resolveCategoryId(row, options, categories);
    if (options.defaultAffiliateCommission !== undefined) {
      dto.affiliateCommission = options.defaultAffiliateCommission;
    }
    return dto;
  }

  private rowToUpdateDto(
    row: ParsedImportRow,
    options: ProductImportOptionsDto,
    categories: CategoryMatchCandidate[],
  ): UpdateProductDto {
    const dto = new UpdateProductDto();
    if (row.name) dto.name = row.name;
    if (row.description) dto.description = row.description;
    if (row.details !== undefined) dto.details = row.details;
    if (row.regularPrice !== undefined) dto.regularPrice = row.regularPrice;
    if (row.salePrice !== undefined) dto.salePrice = row.salePrice;
    if (row.salePriceExpiresAt) dto.salePriceExpiresAt = row.salePriceExpiresAt;
    if (row.stock !== undefined) dto.stock = row.stock;
    if (row.images?.length) dto.images = row.images;
    const categoryId = this.resolveCategoryId(row, options, categories);
    if (categoryId) dto.categoryId = categoryId;
    if (options.defaultAffiliateCommission !== undefined) {
      dto.affiliateCommission = options.defaultAffiliateCommission;
    }
    return dto;
  }

  private buildPreviewResult(
    format: ImportPreviewResult['format'],
    parsed: ParsedImportRow[],
    totalDataRows: number,
  ): ImportPreviewResult {
    const counts = {
      readyToImport: 0,
      skippedUnpublished: 0,
      skippedNoPrice: 0,
      skippedNoImages: 0,
      skippedVariant: 0,
      skippedMalformed: 0,
      duplicateSkus: 0,
    };

    const errors: { line: number; message: string }[] = [];

    for (const row of parsed) {
      switch (row.status) {
        case 'ready':
          counts.readyToImport++;
          break;
        case 'duplicate_update':
          counts.readyToImport++;
          counts.duplicateSkus++;
          break;
        case 'duplicate_skip':
          counts.duplicateSkus++;
          if (errors.length < PREVIEW_ERROR_CAP && row.message) {
            errors.push({ line: row.line, message: row.message });
          }
          break;
        case 'skipped_unpublished':
          counts.skippedUnpublished++;
          break;
        case 'skipped_no_price':
          counts.skippedNoPrice++;
          break;
        case 'skipped_no_images':
          counts.skippedNoImages++;
          break;
        case 'skipped_variant':
          counts.skippedVariant++;
          break;
        case 'skipped_malformed':
          counts.skippedMalformed++;
          if (errors.length < PREVIEW_ERROR_CAP && row.message) {
            errors.push({ line: row.line, message: row.message });
          }
          break;
      }
    }

    const uniqueCategories = [
      ...new Set(
        parsed
          .map((r) => r.categoryLabel)
          .filter((c): c is string => !!c),
      ),
    ].sort();

    return {
      format,
      totalDataRows,
      ...counts,
      uniqueCategories,
      suggestedCategoryMappings: {},
      sampleRows: parsed.slice(0, PREVIEW_SAMPLE_LIMIT),
      errors,
    };
  }
}
