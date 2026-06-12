import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Product,
  ProductExternalImageStatus,
  ProductImageSource,
  ProductStatus,
  BrokenImageUrlEntry,
} from '../products/entities/product.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../notifications/entities/notification.entity';
import { User, UserType } from '../users/entities/user.entity';
import {
  ResolveExternalImageAction,
  ResolveExternalImagesDto,
} from './dto/resolve-external-images.dto';

const CHECK_TIMEOUT_MS = 5000;
const IMAGE_CONTENT_TYPES = /^image\//i;

@Injectable()
export class ProductImageHealthService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async checkAllExternalProducts(): Promise<{
    checked: number;
    newlyBroken: number;
  }> {
    const products = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.imageSource = :source', {
        source: ProductImageSource.EXTERNAL,
      })
      .andWhere(
        '(product.externalImageStatus = :healthy OR product.externalImageStatus IS NULL)',
        { healthy: ProductExternalImageStatus.HEALTHY },
      )
      .getMany();

    let newlyBroken = 0;
    for (const product of products) {
      const wasBroken =
        product.externalImageStatus === ProductExternalImageStatus.BROKEN;
      const result = await this.checkProductImages(product);
      if (result.broken && !wasBroken) {
        newlyBroken++;
      }
    }

    return { checked: products.length, newlyBroken };
  }

  async recheckProduct(productId: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
      relations: ['seller', 'category'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.imageSource !== ProductImageSource.EXTERNAL) {
      throw new BadRequestException('Product does not use external images');
    }
    await this.checkProductImages(product);
    return this.productsRepository.findOneOrFail({
      where: { id: productId },
      relations: ['seller', 'category'],
    });
  }

  async getIssuesCount(): Promise<number> {
    return this.productsRepository.count({
      where: {
        imageSource: ProductImageSource.EXTERNAL,
        externalImageStatus: ProductExternalImageStatus.BROKEN,
      },
    });
  }

  async getIssues(page = 1, limit = 20): Promise<{
    products: Product[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;
    const [products, total] = await this.productsRepository.findAndCount({
      where: {
        imageSource: ProductImageSource.EXTERNAL,
        externalImageStatus: ProductExternalImageStatus.BROKEN,
      },
      relations: ['seller', 'category'],
      order: { externalImageIssueAt: 'DESC' },
      skip,
      take: limit,
    });
    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async resolveExternalImages(
    productId: string,
    dto: ResolveExternalImagesDto,
  ): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
      relations: ['seller', 'category'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.externalImageStatus !== ProductExternalImageStatus.BROKEN) {
      throw new BadRequestException(
        'Product does not have a broken external image issue to resolve',
      );
    }

    const now = new Date();

    switch (dto.action) {
      case ResolveExternalImageAction.REPLACE_IMAGES: {
        if (!dto.images?.length) {
          throw new BadRequestException('images are required for replace_images');
        }
        product.images = dto.images;
        product.imageSource = ProductImageSource.UPLOADED;
        product.externalImageStatus = null;
        product.brokenImageUrls = null;
        product.externalImageIssueAt = null;
        product.externalImageResolvedAt = now;
        if (product.approved) {
          product.status = ProductStatus.ACTIVE;
        }
        break;
      }
      case ResolveExternalImageAction.KEEP_DEACTIVATED: {
        product.externalImageStatus = ProductExternalImageStatus.RESOLVED;
        product.externalImageResolvedAt = now;
        product.status = ProductStatus.INACTIVE;
        break;
      }
      case ResolveExternalImageAction.DISMISS: {
        product.externalImageStatus = ProductExternalImageStatus.RESOLVED;
        product.externalImageResolvedAt = now;
        product.brokenImageUrls = null;
        product.externalImageIssueAt = null;
        if (product.approved) {
          product.status = ProductStatus.ACTIVE;
        }
        break;
      }
      default:
        throw new BadRequestException('Invalid action');
    }

    await this.productsRepository.save(product);
    return product;
  }

  private async checkProductImages(
    product: Product,
  ): Promise<{ broken: boolean; brokenUrls: BrokenImageUrlEntry[] }> {
    const images = Array.isArray(product.images) ? product.images : [];
    const brokenUrls: BrokenImageUrlEntry[] = [];
    const checkedAt = new Date().toISOString();

    for (const url of images) {
      const check = await this.checkImageUrl(url);
      if (!check.ok) {
        brokenUrls.push({
          url,
          checkedAt,
          httpStatus: check.status,
        });
      }
    }

    if (brokenUrls.length > 0) {
      const wasHealthy =
        product.externalImageStatus !== ProductExternalImageStatus.BROKEN;
      product.externalImageStatus = ProductExternalImageStatus.BROKEN;
      product.brokenImageUrls = brokenUrls;
      product.status = ProductStatus.INACTIVE;
      if (!product.externalImageIssueAt) {
        product.externalImageIssueAt = new Date();
      }
      await this.productsRepository.save(product);

      if (wasHealthy) {
        await this.notifyAdminsBrokenImages(product, brokenUrls);
      }
      return { broken: true, brokenUrls };
    }

    product.externalImageStatus = ProductExternalImageStatus.HEALTHY;
    product.brokenImageUrls = null;
    await this.productsRepository.save(product);
    return { broken: false, brokenUrls: [] };
  }

  private async checkImageUrl(
    url: string,
  ): Promise<{ ok: boolean; status: number | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      let response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });

      if (response.status === 405 || response.status === 501) {
        response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
          headers: { Range: 'bytes=0-0' },
        });
      }

      const contentType = response.headers.get('content-type') || '';
      const status = response.status;
      const ok =
        response.ok &&
        (IMAGE_CONTENT_TYPES.test(contentType) || contentType === '');

      return { ok, status };
    } catch {
      return { ok: false, status: null };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async notifyAdminsBrokenImages(
    product: Product,
    brokenUrls: BrokenImageUrlEntry[],
  ): Promise<void> {
    try {
      const admins = await this.usersRepository.find({
        where: { userType: UserType.ADMIN },
      });

      const notifications = await this.notificationsService.createMany(
        admins.map((admin) => ({
          userId: admin.id,
          type: NotificationType.PRODUCT_EXTERNAL_IMAGE_BROKEN,
          title: 'Product image unavailable',
          message: `"${product.name}" has broken external image links and was taken offline pending review.`,
          metadata: {
            productId: product.id,
            productName: product.name,
            sellerId: product.sellerId,
            brokenUrls: brokenUrls.map((b) => b.url),
            importSource: product.importSource,
          },
          link: `/admin/products?externalImageIssue=broken`,
        })),
      );

      for (const notification of notifications) {
        await this.notificationsGateway.sendNotificationToUser(
          notification.userId,
          notification,
        );
      }
    } catch (error) {
      console.error('Failed to notify admins about broken images:', error);
    }
  }
}
