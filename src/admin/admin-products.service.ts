import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from '../products/entities/product.entity';
import { AdminQueryDto } from './dto/admin-query.dto';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../notifications/entities/notification.entity';
import { EmailService } from '../auth/services/email.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AdminProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(SellerSettings)
    private sellerSettingsRepository: Repository<SellerSettings>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
  ) {}

  async findAll(
    query: AdminQueryDto & {
      status?: ProductStatus;
      sellerId?: string;
      approved?: boolean;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.seller', 'seller')
      .leftJoinAndSelect('product.category', 'category')
      .orderBy('product.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      queryBuilder.where(
        '(product.name ILIKE :search OR product.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.status) {
      queryBuilder.andWhere('product.status = :status', {
        status: query.status,
      });
    }

    if (query.sellerId) {
      queryBuilder.andWhere('product.sellerId = :sellerId', {
        sellerId: query.sellerId,
      });
    }

    if (query.approved !== undefined) {
      queryBuilder.andWhere('product.approved = :approved', {
        approved: query.approved,
      });
    }

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price.toString()),
        stock: product.stock,
        status: product.status,
        approved: product.approved,
        rejectionMessage: product.rejectionMessage,
        rejectedAt: product.rejectedAt,
        sellerId: product.sellerId,
        seller: product.seller
          ? {
              id: product.seller.id,
              name: product.seller.name,
              email: product.seller.email,
            }
          : null,
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
            }
          : null,
        affiliateCommission: parseFloat(product.affiliateCommission.toString()),
        sales: product.sales,
        rating: product.rating,
        reviewsCount: product.reviewsCount,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveProduct(productId: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.approved) {
      throw new BadRequestException('Product is already approved');
    }

    product.approved = true;
    // Clear rejection fields when approving
    product.rejectionMessage = null;
    product.rejectedAt = null;
    // Set status to ACTIVE if it was INACTIVE
    if (product.status === ProductStatus.INACTIVE) {
      product.status = ProductStatus.ACTIVE;
    }

    const updatedProduct = await this.productsRepository.save(product);

    // Send notification to seller about approval
    try {
      const notification =
        await this.notificationsService.createProductNotification(
          product.sellerId,
          NotificationType.PRODUCT_APPROVED,
          updatedProduct.id,
          updatedProduct.name,
          undefined, // No additional data - ensures pendingApproval is not set
          '/en/seller/products', // Link to seller products page
        );
      await this.notificationsGateway.sendNotificationToUser(
        product.sellerId,
        notification,
      );

      // Send email notification to seller
      const seller = await this.usersRepository.findOne({
        where: { id: product.sellerId },
      });
      if (seller?.email) {
        await this.emailService.sendSellerNotification(
          seller.email,
          'product_approved',
          {
            productName: updatedProduct.name,
          },
        );
      }
    } catch (error) {
      // Log error but don't fail approval
      console.error(
        `Failed to send product approval notification to seller:`,
        error,
      );
    }

    return updatedProduct;
  }

  async rejectProduct(productId: string, message: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Allow rejecting any product that is not approved
    // This includes: new products pending approval, and previously rejected products that were updated
    if (product.approved) {
      throw new BadRequestException(
        'Cannot reject an approved product. Please unapprove it first.',
      );
    }

    product.approved = false;
    product.status = ProductStatus.INACTIVE;
    product.rejectionMessage = message;
    product.rejectedAt = new Date();

    const updatedProduct = await this.productsRepository.save(product);

    // Send notification to seller about rejection
    try {
      const notification =
        await this.notificationsService.createProductNotification(
          product.sellerId,
          NotificationType.PRODUCT_REJECTED,
          updatedProduct.id,
          updatedProduct.name,
          { rejectionMessage: message }, // Include rejection message in metadata
          '/en/seller/products', // Link to seller products page
          message, // Custom message for rejection
        );
      await this.notificationsGateway.sendNotificationToUser(
        product.sellerId,
        notification,
      );

      // Send email notification to seller
      const seller = await this.usersRepository.findOne({
        where: { id: product.sellerId },
      });
      if (seller?.email) {
        await this.emailService.sendSellerNotification(
          seller.email,
          'product_rejected',
          {
            productName: updatedProduct.name,
            rejectionMessage: message,
          },
        );
      }
    } catch (error) {
      // Log error but don't fail rejection
      console.error(
        `Failed to send product rejection notification to seller:`,
        error,
      );
    }

    return updatedProduct;
  }

  async getStatistics() {
    const [total, active, inactive, approved, pendingApproval] =
      await Promise.all([
        this.productsRepository.count(),
        this.productsRepository.count({
          where: { status: ProductStatus.ACTIVE },
        }),
        this.productsRepository.count({
          where: { status: ProductStatus.INACTIVE },
        }),
        this.productsRepository.count({ where: { approved: true } }),
        this.productsRepository.count({ where: { approved: false } }),
      ]);

    const lowStockProducts = await this.productsRepository.find({
      where: { status: ProductStatus.ACTIVE, approved: true },
    });

    const lowStockCount = lowStockProducts.filter((p) => p.stock < 10).length;

    return {
      total,
      active,
      inactive,
      approved,
      pendingApproval,
      lowStock: lowStockCount,
    };
  }
}
