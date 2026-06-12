import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ProductImportService } from './product-import.service';
import { parseProductImportOptions } from './import-options.util';
import { productImportMulterOptions } from './import-upload.config';

@ApiTags('seller-products-import')
@ApiBearerAuth('JWT-auth')
@Controller('seller/products/import')
@UseGuards(JwtAuthGuard)
export class ProductImportController {
  constructor(private readonly productImportService: ProductImportService) {}

  @Post('preview')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Preview product import from WooCommerce or Shopify export' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        options: {
          type: 'string',
          description: 'JSON string of ProductImportOptionsDto',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', productImportMulterOptions))
  preview(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('options') optionsJson?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File required as multipart field "file".');
    }
    const options = parseProductImportOptions(optionsJson);
    return this.productImportService.preview(
      file.buffer,
      file.originalname || 'import.csv',
      user.id,
      options,
    );
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import products from WooCommerce or Shopify export' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        options: {
          type: 'string',
          description: 'JSON string of ProductImportOptionsDto',
        },
      },
      required: ['file', 'options'],
    },
  })
  @UseInterceptors(FileInterceptor('file', productImportMulterOptions))
  import(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('options') optionsJson?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File required as multipart field "file".');
    }
    const options = parseProductImportOptions(optionsJson, true)!;
    return this.productImportService.import(
      file.buffer,
      file.originalname || 'import.csv',
      user.id,
      options,
    );
  }

}
