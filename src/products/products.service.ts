import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product, ProductStatus } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { PublicProductQueryDto } from './dto/public-product-query.dto';
import { User, UserType } from '../users/entities/user.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../notifications/entities/notification.entity';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class ProductsService {
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
  ) {}

  async create(
    sellerId: string,
    createProductDto: CreateProductDto,
  ): Promise<Product> {
    // Check if seller is verified
    const sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    const isVerified = sellerSettings?.verified || false;

    const { category, ...productData } = createProductDto;
    const product = this.productsRepository.create({
      ...productData,
      sellerId,
      approved: isVerified, // Auto-approve if seller is verified
      status: isVerified ? ProductStatus.ACTIVE : ProductStatus.INACTIVE, // Set to inactive if not approved
    });

    const savedProduct = await this.productsRepository.save(product);

    // Send notification to admins if product needs approval
    if (!savedProduct.approved) {
      try {
        // Find all admin users
        const adminUsers = await this.usersRepository.find({
          where: { userType: UserType.ADMIN },
        });

        // Create notifications for all admins
        const notifications = await this.notificationsService.createMany(
          adminUsers.map((admin) => ({
            userId: admin.id,
            type: NotificationType.PRODUCT_APPROVED, // Using this type for pending approval
            title: 'New Product Pending Approval',
            message: `Product "${savedProduct.name}" from seller needs approval`,
            metadata: {
              productId: savedProduct.id,
              productName: savedProduct.name,
              sellerId: savedProduct.sellerId,
              pendingApproval: true,
            },
            link: `/admin/products`,
          })),
        );

        // Send real-time notifications to all connected admins
        for (const notification of notifications) {
          await this.notificationsGateway.sendNotificationToUser(
            notification.userId,
            notification,
          );
        }
      } catch (error) {
        // Log error but don't fail product creation
        console.error(`Failed to send product approval notification:`, error);
      }
    }

    // Reload with category relation
    return this.productsRepository.findOneOrFail({
      where: { id: savedProduct.id },
      relations: ['category'],
    });
  }

  async findAll(
    sellerId: string,
    query: ProductQueryDto,
    userType?: UserType,
  ): Promise<{ products: Product[]; pagination: any }> {
    const { page = 1, limit = 20, status, search, category } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productsRepository.createQueryBuilder('product');

    // Admins can see all products, sellers only see their own
    const isAdmin = userType === UserType.ADMIN;
    let hasWhereClause = false;

    if (!isAdmin) {
      queryBuilder.where('product.sellerId = :sellerId', { sellerId });
      hasWhereClause = true;
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        if (hasWhereClause) {
          queryBuilder.andWhere('product.status = :status', {
            status: ProductStatus.ACTIVE,
          });
        } else {
          queryBuilder.where('product.status = :status', {
            status: ProductStatus.ACTIVE,
          });
          hasWhereClause = true;
        }
      } else if (status === 'out_of_stock') {
        if (hasWhereClause) {
          queryBuilder.andWhere('product.status = :status', {
            status: ProductStatus.OUT_OF_STOCK,
          });
        } else {
          queryBuilder.where('product.status = :status', {
            status: ProductStatus.OUT_OF_STOCK,
          });
          hasWhereClause = true;
        }
      }
    }

    if (search) {
      if (hasWhereClause) {
        queryBuilder.andWhere('product.name ILIKE :search', {
          search: `%${search}%`,
        });
      } else {
        queryBuilder.where('product.name ILIKE :search', {
          search: `%${search}%`,
        });
        hasWhereClause = true;
      }
    }

    if (category) {
      if (hasWhereClause) {
        queryBuilder.andWhere('product.categoryId = :categoryId', {
          categoryId: category,
        });
      } else {
        queryBuilder.where('product.categoryId = :categoryId', {
          categoryId: category,
        });
        hasWhereClause = true;
      }
    }

    queryBuilder.skip(skip).take(limit).orderBy('product.createdAt', 'DESC');

    queryBuilder.leftJoinAndSelect('product.category', 'category');

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    sellerId: string,
    userType?: UserType,
  ): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Admins can access any product, sellers can only access their own
    if (userType !== UserType.ADMIN && product.sellerId !== sellerId) {
      throw new ForbiddenException('You do not have access to this product');
    }

    return product;
  }

  async update(
    id: string,
    sellerId: string,
    updateProductDto: UpdateProductDto,
    userType?: UserType,
  ): Promise<Product> {
    const product = await this.findOne(id, sellerId, userType);

    // Update stock status if stock is 0
    if (updateProductDto.stock !== undefined) {
      if (
        updateProductDto.stock === 0 &&
        product.status === ProductStatus.ACTIVE
      ) {
        product.status = ProductStatus.OUT_OF_STOCK;
      } else if (
        updateProductDto.stock > 0 &&
        product.status === ProductStatus.OUT_OF_STOCK
      ) {
        product.status = ProductStatus.ACTIVE;
      }
    }

    const { category, ...productData } = updateProductDto;
    Object.assign(product, productData);

    // If product was previously rejected and seller is updating it,
    // clear rejection fields to indicate it needs re-review
    // The approval status remains false until admin reviews it again
    if (product.rejectionMessage || product.rejectedAt) {
      product.rejectionMessage = null;
      product.rejectedAt = null;
    }

    // Note: Updating an existing product doesn't change its approval status
    // Only new products require approval (unless seller is verified)
    // If a rejected product is updated, it remains unapproved and needs re-review

    const updatedProduct = await this.productsRepository.save(product);

    // Reload with category relation
    return this.productsRepository.findOneOrFail({
      where: { id: updatedProduct.id },
      relations: ['category'],
    });
  }

  async remove(
    id: string,
    sellerId: string,
    userType?: UserType,
  ): Promise<void> {
    const product = await this.findOne(id, sellerId, userType);
    await this.productsRepository.remove(product);
  }

  async updateImages(
    id: string,
    sellerId: string,
    images: string[],
    userType?: UserType,
  ): Promise<Product> {
    const product = await this.findOne(id, sellerId, userType);
    product.images = images;
    const updatedProduct = await this.productsRepository.save(product);

    // Reload with category relation
    return this.productsRepository.findOneOrFail({
      where: { id: updatedProduct.id },
      relations: ['category'],
    });
  }

  // Public methods - no seller filtering
  async findAllPublic(
    query: PublicProductQueryDto,
  ): Promise<{ products: Product[]; pagination: any }> {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      sellerId,
      sortBy = 'newest',
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.seller', 'seller')
      .leftJoin(
        SellerSettings,
        'sellerSettings',
        'sellerSettings.sellerId = product.sellerId',
      )
      .addSelect(['sellerSettings.storeName', 'sellerSettings.logo'])
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.approved = :approved', { approved: true }) // Only show approved products
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.andWhere('product.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (category) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: category,
      });
    }

    if (sellerId) {
      queryBuilder.andWhere('product.sellerId = :sellerId', {
        sellerId,
      });
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        queryBuilder.orderBy('product.createdAt', 'DESC');
        break;
      case 'oldest':
        queryBuilder.orderBy('product.createdAt', 'ASC');
        break;
      case 'price_asc':
        queryBuilder.orderBy('product.price', 'ASC');
        break;
      case 'price_desc':
        queryBuilder.orderBy('product.price', 'DESC');
        break;
      case 'name_asc':
        queryBuilder.orderBy('product.name', 'ASC');
        break;
      case 'name_desc':
        queryBuilder.orderBy('product.name', 'DESC');
        break;
      default:
        queryBuilder.orderBy('product.createdAt', 'DESC');
    }

    const [products, total] = await queryBuilder.getManyAndCount();

    // Get unique seller IDs
    const sellerIds = [...new Set(products.map((p) => p.sellerId))];

    // Fetch all seller settings in one query
    const sellerSettingsMap = new Map<string, SellerSettings>();
    if (sellerIds.length > 0) {
      const sellerSettings = await this.sellerSettingsRepository.find({
        where: { sellerId: In(sellerIds) },
      });
      sellerSettings.forEach((settings) => {
        sellerSettingsMap.set(settings.sellerId, settings);
      });
    }

    // Map products to include storeName from sellerSettings
    const productsWithStore = products.map((product) => {
      const sellerSettings = sellerSettingsMap.get(product.sellerId);
      return {
        ...product,
        seller: {
          ...product.seller,
          storeName: sellerSettings?.storeName || null,
          storeLogo: sellerSettings?.logo || null,
        },
      };
    });

    return {
      products: productsWithStore,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOnePublic(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id, status: ProductStatus.ACTIVE, approved: true },
      relations: ['category', 'seller'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get seller settings to include store name
    const sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId: product.sellerId },
    });

    return {
      ...product,
      seller: {
        ...product.seller,
        storeName: sellerSettings?.storeName || null,
        storeLogo: sellerSettings?.logo || null,
      },
    } as Product;
  }
}
