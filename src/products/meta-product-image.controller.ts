import { Controller, Get, Head, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MetaProductImageService } from './meta-product-image.service';

@ApiTags('meta-catalog')
@SkipThrottle()
@Controller('meta-product-image')
export class MetaProductImageController {
  constructor(
    private readonly metaProductImageService: MetaProductImageService,
  ) {}

  @Head(':productId')
  async headImage(
    @Param('productId') productId: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.metaProductImageService.streamProductImage(productId, res, true);
  }

  @Get(':productId')
  @ApiOperation({
    summary: 'Meta catalog product image (same-domain JPEG/PNG proxy)',
    description:
      'Serves a Meta-compliant JPEG/PNG for Commerce Manager image_link. Proxied from Cloudinary on demand.',
  })
  async getImage(
    @Param('productId') productId: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.metaProductImageService.streamProductImage(productId, res);
  }
}
