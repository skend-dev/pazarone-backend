import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ProductsService } from './products.service';
import { pickReachableMetaCatalogImageUrl } from './meta-catalog-image.resolver';

const META_CATALOG_FETCH_UA =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class MetaProductImageService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
  ) {}

  private siteOrigin(): string {
    const url =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  async streamProductImage(rawProductId: string, res: Response): Promise<void> {
    const origin = this.siteOrigin();
    const fallback = `${origin}/og-image.png`;
    const productId = rawProductId.replace(/\.jpe?g$/i, '');

    let sourceUrl = fallback;

    if (UUID_RE.test(productId)) {
      try {
        const product = await this.productsService.findOnePublic(
          productId,
          false,
        );
        sourceUrl = await pickReachableMetaCatalogImageUrl(
          product.images,
          origin,
        );
      } catch {
        sourceUrl = fallback;
      }
    }

    await this.streamImageUrl(sourceUrl, res, fallback);
  }

  private async streamImageUrl(
    url: string,
    res: Response,
    fallback: string,
  ): Promise<void> {
    const tryFetch = async (target: string) => {
      try {
        const response = await fetch(target, {
          method: 'GET',
          headers: {
            'User-Agent': META_CATALOG_FETCH_UA,
            Accept: 'image/jpeg,image/png,*/*',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type') ?? '';
        if (
          !contentType.includes('image/jpeg') &&
          !contentType.includes('image/png')
        ) {
          return null;
        }
        return response;
      } catch {
        return null;
      }
    };

    let response = await tryFetch(url);
    if (!response && url !== fallback) {
      response = await tryFetch(fallback);
    }

    if (!response) {
      res.status(404).send('Image not found');
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=604800',
    );
    res.send(buffer);
  }
}
