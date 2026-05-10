import {
  Controller,
  Get,
  Query,
  Res,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MetaCatalogFeedService } from './meta-catalog-feed.service';
import type { MetaCatalogFeedFilters } from './dto/meta-catalog-feed-filters.dto';

@ApiTags('meta-catalog')
@SkipThrottle()
@Controller('meta-feed')
export class MetaCatalogFeedController {
  constructor(private readonly metaCatalogFeedService: MetaCatalogFeedService) {}

  @Get()
  @ApiOperation({
    summary: 'Meta / Google product catalog feed (RSS + g: namespace)',
    description:
      'Public product list for Commerce Manager. Optional filters: category, categories, sellerId, sellerIds. Optional META_CATALOG_FEED_SECRET + ?token=',
  })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'xml'] })
  @ApiQuery({ name: 'locale', required: false, description: 'Storefront locale segment (default mk)' })
  @ApiQuery({ name: 'token', required: false, description: 'If META_CATALOG_FEED_SECRET is set' })
  @ApiQuery({ name: 'category', required: false, description: 'Single category UUID' })
  @ApiQuery({ name: 'categories', required: false, description: 'Comma-separated category UUIDs' })
  @ApiQuery({ name: 'sellerId', required: false, description: 'Single seller UUID' })
  @ApiQuery({ name: 'sellerIds', required: false, description: 'Comma-separated seller UUIDs' })
  @Header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  async getFeed(
    @Query('format') format: string | undefined,
    @Query('locale') locale: string | undefined,
    @Query('token') token: string | undefined,
    @Query('category') category: string | undefined,
    @Query('categories') categories: string | undefined,
    @Query('sellerId') sellerId: string | undefined,
    @Query('sellerIds') sellerIds: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    this.metaCatalogFeedService.assertToken(token);

    const loc =
      locale?.trim() || this.metaCatalogFeedService.defaultLocale();

    const filters: MetaCatalogFeedFilters | undefined =
      category?.trim() ||
      categories?.trim() ||
      sellerId?.trim() ||
      sellerIds?.trim()
        ? {
            category: category?.trim() || undefined,
            categories: categories?.trim() || undefined,
            sellerId: sellerId?.trim() || undefined,
            sellerIds: sellerIds?.trim() || undefined,
          }
        : undefined;

    if (format === 'json') {
      const body = await this.metaCatalogFeedService.getJson(loc, filters);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(body);
      return;
    }

    const xml = await this.metaCatalogFeedService.getXml(loc, filters);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  }
}
