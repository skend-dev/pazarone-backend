import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { ProductImportService } from './product-import.service';
import { ProductImageHealthService } from './product-image-health.service';
import { parseProductImportOptions } from './import-options.util';
import { productImportMulterOptions } from './import-upload.config';
import {
  initImportStreamResponse,
  writeImportStreamEvent,
} from './import-stream.util';
import { ResolveExternalImagesDto } from './dto/resolve-external-images.dto';

@ApiTags('admin-products-import')
@ApiBearerAuth('JWT-auth')
@Controller('admin/products')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class AdminProductImportController {
  constructor(
    private readonly productImportService: ProductImportService,
    private readonly productImageHealthService: ProductImageHealthService,
  ) {}

  @Post('import/preview')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Preview product import for a seller (admin)' })
  @UseInterceptors(FileInterceptor('file', productImportMulterOptions))
  preview(
    @Query('sellerId', ParseUUIDPipe) sellerId: string,
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
      sellerId,
      options,
    );
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import products for a seller (admin)' })
  @UseInterceptors(FileInterceptor('file', productImportMulterOptions))
  import(
    @Query('sellerId', ParseUUIDPipe) sellerId: string,
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
      sellerId,
      options,
    );
  }

  @Post('import/stream')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import products for a seller with live progress (admin)' })
  @UseInterceptors(FileInterceptor('file', productImportMulterOptions))
  async importStream(
    @Query('sellerId', ParseUUIDPipe) sellerId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('options') optionsJson?: string,
    @Res() res?: Response,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File required as multipart field "file".');
    }
    if (!res) {
      throw new BadRequestException('Streaming response unavailable.');
    }
    const options = parseProductImportOptions(optionsJson, true)!;
    initImportStreamResponse(res);

    try {
      const result = await this.productImportService.import(
        file.buffer,
        file.originalname || 'import.csv',
        sellerId,
        options,
        (data) => writeImportStreamEvent(res, { type: 'progress', data }),
      );
      writeImportStreamEvent(res, { type: 'complete', result });
    } catch (err) {
      writeImportStreamEvent(res, {
        type: 'error',
        message: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      res.end();
    }
  }

  @Get('external-image-issues/count')
  @ApiOperation({ summary: 'Count products with broken external images' })
  getIssuesCount() {
    return this.productImageHealthService.getIssuesCount();
  }

  @Get('external-image-issues')
  @ApiOperation({ summary: 'List products with broken external images' })
  getIssues(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.productImageHealthService.getIssues(p, l);
  }

  @Post('external-image-issues/recheck-all')
  @ApiOperation({
    summary: 'Re-check all external product images and refresh broken status',
  })
  recheckAllExternalImages() {
    return this.productImageHealthService.checkAllExternalProducts();
  }

  @Put(':id/resolve-external-images')
  @ApiOperation({ summary: 'Resolve a broken external image issue' })
  resolveExternalImages(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveExternalImagesDto,
  ) {
    return this.productImageHealthService.resolveExternalImages(id, dto);
  }

  @Post(':id/recheck-external-images')
  @ApiOperation({ summary: 'Manually re-check external image URLs for a product' })
  recheckExternalImages(@Param('id', ParseUUIDPipe) id: string) {
    return this.productImageHealthService.recheckProduct(id);
  }

}
