import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ProductImportOptionsDto } from './dto/product-import-options.dto';

export function parseProductImportOptions(
  json?: string,
  required = false,
): ProductImportOptionsDto | undefined {
  if (!json?.trim()) {
    if (required) {
      throw new BadRequestException('options JSON is required for import.');
    }
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BadRequestException('Invalid options JSON');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new BadRequestException('Invalid options JSON');
  }

  const dto = plainToInstance(ProductImportOptionsDto, parsed);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    throw new BadRequestException('Invalid import options');
  }

  return dto;
}
