import {
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import type { MetaCatalogFeedFilters } from './dto/meta-catalog-feed-filters.dto';
import {
  buildMetaProductFeedXml,
  productToMetaFeedItemJson,
} from './meta-catalog-feed.helpers';

const DEFAULT_LOCALE = 'mk';

@Injectable()
export class MetaCatalogFeedService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
  ) {}

  assertToken(token: string | undefined): void {
    const secret = this.configService.get<string>('META_CATALOG_FEED_SECRET');
    if (!secret) return;
    if (token !== secret) {
      throw new ForbiddenException('Invalid or missing feed token');
    }
  }

  private siteOrigin(): string {
    const url =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  async fetchAllFeedProducts(
    filters?: MetaCatalogFeedFilters,
  ): Promise<Product[]> {
    const all: Product[] = [];
    let page = 1;
    const limit = 100;

    for (;;) {
      const { products, pagination } =
        await this.productsService.findAllForMetaCatalogFeed(
          page,
          limit,
          filters,
        );
      all.push(...products);
      if (page >= pagination.totalPages || products.length < limit) break;
      page += 1;
    }

    return all.filter((p) => {
      if (p.approved === false) return false;
      if (p.status === 'inactive') return false;
      return true;
    });
  }

  async getXml(
    locale: string,
    filters?: MetaCatalogFeedFilters,
  ): Promise<string> {
    const products = await this.fetchAllFeedProducts(filters);
    const origin = this.siteOrigin();
    return buildMetaProductFeedXml(products, origin, locale);
  }

  async getJson(
    locale: string,
    filters?: MetaCatalogFeedFilters,
  ): Promise<{
    items: ReturnType<typeof productToMetaFeedItemJson>[];
    count: number;
  }> {
    const products = await this.fetchAllFeedProducts(filters);
    const origin = this.siteOrigin();
    const items = products.map((p) =>
      productToMetaFeedItemJson(p, origin, locale),
    );
    return { items, count: items.length };
  }

  defaultLocale(): string {
    return (
      this.configService.get<string>('META_CATALOG_DEFAULT_LOCALE') ||
      DEFAULT_LOCALE
    );
  }
}
