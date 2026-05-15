import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import { Product, ProductStatus } from './entities/product.entity';
import { ProductVariantAttribute } from './entities/product-variant-attribute.entity';
import { ProductVariantValue } from './entities/product-variant-value.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { PublicProductQueryDto } from './dto/public-product-query.dto';
import { MetaCatalogFeedFilters } from './dto/meta-catalog-feed-filters.dto';
import { User, UserType } from '../users/entities/user.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../notifications/entities/notification.entity';
import { forwardRef, Inject } from '@nestjs/common';
import { CurrencyService, Market } from '../common/currency/currency.service';
import { OrderItem } from '../orders/entities/order-item.entity';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  /**
   * Normalize product images to always return a string array
   * Handles legacy formats (objects, null, JSON strings, etc.)
   */
  private normalizeImages(images: any): string[] {
    if (!images) {
      return [];
    }
    
    // Handle JSON string (common with jsonb columns that return as strings)
    if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) {
          images = parsed;
        } else {
          return [];
        }
      } catch (error) {
        // If it's not valid JSON, treat as a single URL string
        if (images.startsWith('http')) {
          return [images];
        }
        return [];
      }
    }
    
    if (!Array.isArray(images)) {
      return [];
    }
    
    return images
      .map((img: any) => {
        if (typeof img === 'string') {
          return img;
        } else if (img && typeof img === 'object' && img !== null && 'url' in img) {
          return (img as { url: string }).url;
        }
        return null;
      })
      .filter((url): url is string => url !== null && typeof url === 'string');
  }

  /** Compare image lists as sets (order-insensitive). */
  private areImageListsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((url, i) => url === sortedB[i]);
  }

  /**
   * Notify all admins that a product needs manual approval (reuse PRODUCT_APPROVED type + pendingApproval metadata).
   */
  private async notifyAdminsProductPendingApproval(
    product: Pick<Product, 'id' | 'name' | 'sellerId'>,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      const adminUsers = await this.usersRepository.find({
        where: { userType: UserType.ADMIN },
      });

      const notifications = await this.notificationsService.createMany(
        adminUsers.map((admin) => ({
          userId: admin.id,
          type: NotificationType.PRODUCT_APPROVED,
          title,
          message,
          metadata: {
            productId: product.id,
            productName: product.name,
            sellerId: product.sellerId,
            pendingApproval: true,
          },
          link: `/admin/products`,
        })),
      );

      for (const notification of notifications) {
        await this.notificationsGateway.sendNotificationToUser(
          notification.userId,
          notification,
        );
      }
    } catch (error) {
      console.error(`Failed to send product approval notification:`, error);
    }
  }

  /**
   * Seller changed listing images: require admin approval again (same visibility rules as a new unapproved product).
   */
  private async applyImageChangeReapproval(
    product: Product,
    notifyTitle: string,
    notifyMessage: string,
  ): Promise<void> {
    product.approved = false;
    product.status = ProductStatus.INACTIVE;
    product.rejectionMessage = null;
    product.rejectedAt = null;
    await this.notifyAdminsProductPendingApproval(
      product,
      notifyTitle,
      notifyMessage,
    );
  }

  /**
   * Check if sale price is still valid (not expired)
   */
  private isSalePriceValid(
    salePrice: number | null | undefined,
    salePriceExpiresAt: Date | null | undefined,
  ): boolean {
    if (!salePrice) {
      return false;
    }
    if (!salePriceExpiresAt) {
      return true; // No expiration means sale is valid indefinitely
    }
    return new Date() < new Date(salePriceExpiresAt);
  }

  /**
   * Get effective price considering sale price and expiration
   */
  private getEffectivePrice(
    salePrice: number | null | undefined,
    regularPrice: number | null | undefined,
    legacyPrice: number | null | undefined,
    salePriceExpiresAt: Date | null | undefined,
  ): number | null {
    // Check if sale price is valid (exists and not expired)
    if (this.isSalePriceValid(salePrice, salePriceExpiresAt)) {
      return salePrice!;
    }
    // Otherwise use regular price or legacy price
    return regularPrice ?? legacyPrice ?? null;
  }

  /**
   * Normalize product prices to ensure expired sale prices are handled
   * Updates the price field to reflect the current effective price
   */
  private normalizeProductPrice(product: Product): Product {
    // When product has active sale but regularPrice is null, use the stored price or basePrice
    // as the comparison base for discount calculation (legacy products may not have regularPrice set)
    if (
      this.isSalePriceValid(product.salePrice, product.salePriceExpiresAt) &&
      (product.regularPrice == null || product.regularPrice === undefined)
    ) {
      const priceNum =
        product.price != null ? Number(product.price) : null;
      const basePriceNum =
        product.basePrice != null ? Number(product.basePrice) : null;
      const salePriceNum =
        product.salePrice != null ? Number(product.salePrice) : null;

      if (salePriceNum != null) {
        if (priceNum != null && priceNum > salePriceNum) {
          product.regularPrice = priceNum;
        } else if (basePriceNum != null && basePriceNum > salePriceNum) {
          product.regularPrice = basePriceNum;
        }
      }
    }

    const effectivePrice = this.getEffectivePrice(
      product.salePrice,
      product.regularPrice,
      product.price,
      product.salePriceExpiresAt,
    );

    if (effectivePrice !== null && effectivePrice !== product.price) {
      product.price = effectivePrice;
      product.basePrice = effectivePrice;
    }

    return product;
  }

  /**
   * Normalize prices for an array of products
   */
  private normalizeProductPrices(products: Product[]): Product[] {
    return products.map((product) => this.normalizeProductPrice(product));
  }

  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductVariantAttribute)
    private variantAttributeRepository: Repository<ProductVariantAttribute>,
    @InjectRepository(ProductVariantValue)
    private variantValueRepository: Repository<ProductVariantValue>,
    @InjectRepository(ProductVariant)
    private variantRepository: Repository<ProductVariant>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(SellerSettings)
    private sellerSettingsRepository: Repository<SellerSettings>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
    private currencyService: CurrencyService,
    private platformSettingsService: PlatformSettingsService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(
    sellerId: string,
    createProductDto: CreateProductDto,
  ): Promise<Product> {
    // Check if seller is verified
    const sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    // Check if seller has payment restrictions (frozen)
    if (sellerSettings?.paymentRestricted) {
      throw new BadRequestException(
        'Cannot create products. Account is frozen due to overdue invoices. Please pay outstanding invoices to continue.',
      );
    }

    const isVerified = sellerSettings?.verified || false;

    // Get seller to determine base currency
    const seller = await this.usersRepository.findOne({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException(`Seller with ID ${sellerId} not found`);
    }

    // Determine seller's base currency from market
    const sellerMarket = (seller.market as Market) || Market.MK; // Default to MK if not set
    const baseCurrency =
      this.currencyService.getBaseCurrencyForMarket(sellerMarket);

    const { category, variantAttributes, variants, ...productData } =
      createProductDto;

    // Validate affiliate commission against platform settings
    if (createProductDto.affiliateCommission !== undefined) {
      const minCommission =
        await this.platformSettingsService.getAffiliateCommissionMin();
      const maxCommission =
        await this.platformSettingsService.getAffiliateCommissionMax();

      if (
        createProductDto.affiliateCommission < minCommission ||
        createProductDto.affiliateCommission > maxCommission
      ) {
        throw new BadRequestException(
          `Affiliate commission must be between ${minCommission}% and ${maxCommission}%`,
        );
      }
    }

    // Validate variants if provided
    if (variants && variants.length > 0) {
      if (!variantAttributes || variantAttributes.length === 0) {
        throw new BadRequestException(
          'Variant attributes are required when variants are provided',
        );
      }
    }

    if (variantAttributes && variantAttributes.length > 0) {
      if (!variants || variants.length === 0) {
        throw new BadRequestException(
          'Variants are required when variant attributes are provided',
        );
      }
    }

    const hasVariants = !!(variants && variants.length > 0);

    // Parse salePriceExpiresAt if provided
    const salePriceExpiresAt = createProductDto.salePriceExpiresAt
      ? new Date(createProductDto.salePriceExpiresAt)
      : null;

    // Determine effective price: salePrice if on sale and not expired, otherwise regularPrice, fallback to price
    const effectivePrice = this.getEffectivePrice(
      createProductDto.salePrice,
      createProductDto.regularPrice,
      createProductDto.price,
      salePriceExpiresAt,
    );

    if (!effectivePrice) {
      throw new BadRequestException(
        'Price, regularPrice, or salePrice must be provided',
      );
    }

    // If product has variants, stock will be calculated from variants
    // Otherwise, use the provided stock
    const product = this.productsRepository.create({
      ...productData,
      sellerId,
      price: effectivePrice, // Set legacy price field for backward compatibility
      regularPrice: createProductDto.regularPrice ?? createProductDto.price ?? null,
      salePrice: createProductDto.salePrice ?? null,
      salePriceExpiresAt: salePriceExpiresAt,
      basePrice: effectivePrice, // Set base price from effective price
      baseCurrency: baseCurrency as string, // Set base currency based on seller's market
      approved: isVerified, // Auto-approve if seller is verified
      status: isVerified ? ProductStatus.ACTIVE : ProductStatus.INACTIVE, // Set to inactive if not approved
      hasVariants,
      // If has variants, stock will be calculated from variants
      stock: hasVariants ? 0 : createProductDto.stock,
      shippingType: createProductDto.shippingType ?? null,
      shippingPriceNorthMacedonia: createProductDto.shippingPriceNorthMacedonia ?? null,
      shippingPriceKosovo: createProductDto.shippingPriceKosovo ?? null,
    });

    let savedProduct: Product;
    try {
      savedProduct = await this.productsRepository.save(product);
    } catch (err) {
      const pg = err instanceof QueryFailedError ? (err as any).driverError ?? err : null;
      const code = pg?.code ?? (err as any)?.code;
      const constraint = pg?.constraint ?? (err as any)?.constraint;
      if (code === '23505' && (constraint === 'UQ_products_sku' || constraint === 'UQ_products_sellerId_sku')) {
        throw new BadRequestException(
          'A product with this SKU already exists in your store. Please use a different SKU.',
        );
      }
      throw err;
    }

    // Create variant attributes and values if provided
    if (hasVariants && variantAttributes) {
      await this.createVariantAttributes(
        savedProduct.id,
        variantAttributes,
        variants!,
        undefined, // No existing variants for new products
      );
    }

    // Send notification to admins if product needs approval
    if (!savedProduct.approved) {
      await this.notifyAdminsProductPendingApproval(
        savedProduct,
        'New Product Pending Approval',
        `Product "${savedProduct.name}" from seller needs approval`,
      );
    }

    // Reload with all relations including variants
    return this.productsRepository.findOneOrFail({
      where: { id: savedProduct.id },
      relations: [
        'category',
        'variantAttributes',
        'variantAttributes.values',
        'variants',
      ],
    });
  }

  async findAll(
    sellerId: string,
    query: ProductQueryDto,
    userType?: UserType,
  ): Promise<{ products: Product[]; pagination: any }> {
    const { page = 1, limit = 20, status, search, category, onSale } = query;
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

    // Filter by sale status
    if (onSale !== undefined) {
      if (onSale === true) {
        // Only products with active sale price (not expired)
        if (hasWhereClause) {
          queryBuilder.andWhere('product.salePrice IS NOT NULL')
            .andWhere(
              '(product.salePriceExpiresAt IS NULL OR product.salePriceExpiresAt > :now)',
              { now: new Date() },
            );
        } else {
          queryBuilder.where('product.salePrice IS NOT NULL')
            .andWhere(
              '(product.salePriceExpiresAt IS NULL OR product.salePriceExpiresAt > :now)',
              { now: new Date() },
            );
          hasWhereClause = true;
        }
      } else {
        // Only products without active sale price
        if (hasWhereClause) {
          queryBuilder.andWhere(
            '(product.salePrice IS NULL OR (product.salePriceExpiresAt IS NOT NULL AND product.salePriceExpiresAt <= :now))',
            { now: new Date() },
          );
        } else {
          queryBuilder.where(
            '(product.salePrice IS NULL OR (product.salePriceExpiresAt IS NOT NULL AND product.salePriceExpiresAt <= :now))',
            { now: new Date() },
          );
          hasWhereClause = true;
        }
      }
    }

    queryBuilder.skip(skip).take(limit).orderBy('product.createdAt', 'DESC');

    queryBuilder.leftJoinAndSelect('product.category', 'category');
    queryBuilder.leftJoinAndSelect(
      'product.variantAttributes',
      'variantAttributes',
    );
    queryBuilder.leftJoinAndSelect('variantAttributes.values', 'variantValues');
    queryBuilder.leftJoinAndSelect('product.variants', 'variants');

    const [products, total] = await queryBuilder.getManyAndCount();

    // Normalize prices to handle expired sale prices
    const normalizedProducts = this.normalizeProductPrices(products);

    return {
      products: normalizedProducts,
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
    let product = await this.productsRepository.findOne({
      where: { id },
      relations: [
        'category',
        'category.parent', // Needed for subcategory resolution in edit form
        'variantAttributes',
        'variantAttributes.values',
        'variants',
      ],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Admins can access any product, sellers can only access their own
    if (userType !== UserType.ADMIN && product.sellerId !== sellerId) {
      throw new ForbiddenException('You do not have access to this product');
    }

    // Normalize price to handle expired sale prices
    return this.normalizeProductPrice(product);
  }

  async update(
    id: string,
    sellerId: string,
    updateProductDto: UpdateProductDto,
    userType?: UserType,
  ): Promise<Product> {
    const product = await this.findOne(id, sellerId, userType);

    // Extract variant-related fields
    const { category, variantAttributes, variants, stock, ...productData } =
      updateProductDto;

    // Validate affiliate commission against platform settings
    if (updateProductDto.affiliateCommission !== undefined) {
      const minCommission =
        await this.platformSettingsService.getAffiliateCommissionMin();
      const maxCommission =
        await this.platformSettingsService.getAffiliateCommissionMax();

      if (
        updateProductDto.affiliateCommission < minCommission ||
        updateProductDto.affiliateCommission > maxCommission
      ) {
        throw new BadRequestException(
          `Affiliate commission must be between ${minCommission}% and ${maxCommission}%`,
        );
      }
    }

    // Validate variants if provided
    if (variants && variants.length > 0) {
      if (!variantAttributes || variantAttributes.length === 0) {
        throw new BadRequestException(
          'Variant attributes are required when variants are provided',
        );
      }
    }

    if (variantAttributes && variantAttributes.length > 0) {
      if (!variants || variants.length === 0) {
        throw new BadRequestException(
          'Variants are required when variant attributes are provided',
        );
      }
    }

    // Clear relations to prevent TypeORM from trying to update them
    // We'll handle variants separately
    product.variantAttributes = undefined as any;
    product.variants = undefined as any;

    // Handle variant updates
    if (variantAttributes && variants) {
      // Get existing variants
      const existingVariants = await this.variantRepository.find({
        where: { productId: id },
      });

      // Create a map of existing variants by normalized combination
      // This helps us identify duplicates and update existing variants instead of creating new ones
      const existingVariantsMap = new Map<string, ProductVariant>();
      for (const variant of existingVariants) {
        const normalizedCombination = this.normalizeCombination(
          variant.combination,
        );
        existingVariantsMap.set(normalizedCombination, variant);
      }

      // Check which variants are used in orders
      const variantIds = existingVariants.map((v) => v.id);
      let usedVariantIds = new Set<string>();

      if (variantIds.length > 0) {
        const usedVariants = await this.orderItemRepository
          .createQueryBuilder('orderItem')
          .select('DISTINCT orderItem.variantId', 'variantId')
          .where('orderItem.variantId IN (:...variantIds)', {
            variantIds,
          })
          .andWhere('orderItem.variantId IS NOT NULL')
          .getRawMany();

        usedVariantIds = new Set(
          usedVariants.map((v) => v.variantId || v.variant_id).filter(Boolean),
        );
      }

      // Create a set of new variant combinations (normalized)
      const newVariantCombinations = new Set<string>();
      for (const variantDto of variants) {
        const normalized = this.normalizeCombination(variantDto.combination);
        newVariantCombinations.add(normalized);
      }

      // Find variants that should be deleted (not in new list and not used in orders)
      const variantsToDelete = existingVariants.filter(
        (v) =>
          !usedVariantIds.has(v.id) &&
          !newVariantCombinations.has(this.normalizeCombination(v.combination)),
      );

      if (variantsToDelete.length > 0) {
        await this.variantRepository.remove(variantsToDelete);
        // Remove from map so they won't be updated
        for (const variant of variantsToDelete) {
          const normalized = this.normalizeCombination(variant.combination);
          existingVariantsMap.delete(normalized);
        }
      }

      // Delete all variant attributes (they can be recreated)
      // Values will be cascade deleted
      await this.variantAttributeRepository.delete({ productId: id });

      // Update hasVariants flag
      product.hasVariants = true;

      // Stock will be calculated from variants in createVariantAttributes
      // Don't update stock manually if variants exist
    } else if (variantAttributes === null || variants === null) {
      // Explicitly removing variants (sending null/empty array)
      // Get existing variants
      const existingVariants = await this.variantRepository.find({
        where: { productId: id },
      });

      // Check which variants are used in orders
      const variantIds = existingVariants.map((v) => v.id);
      let usedVariantIds = new Set<string>();

      if (variantIds.length > 0) {
        const usedVariants = await this.orderItemRepository
          .createQueryBuilder('orderItem')
          .select('DISTINCT orderItem.variantId', 'variantId')
          .where('orderItem.variantId IN (:...variantIds)', {
            variantIds,
          })
          .andWhere('orderItem.variantId IS NOT NULL')
          .getRawMany();

        usedVariantIds = new Set(
          usedVariants.map((v) => v.variantId || v.variant_id).filter(Boolean),
        );
      }

      // Only delete variants that aren't used in orders
      const variantsToDelete = existingVariants.filter(
        (v) => !usedVariantIds.has(v.id),
      );

      if (variantsToDelete.length > 0) {
        await this.variantRepository.remove(variantsToDelete);
      }

      // Mark used variants as inactive instead of deleting
      const variantsToDeactivate = existingVariants.filter((v) =>
        usedVariantIds.has(v.id),
      );
      if (variantsToDeactivate.length > 0) {
        await this.variantRepository.update(
          { id: In(variantsToDeactivate.map((v) => v.id)) },
          { isActive: false },
        );
      }

      // Delete variant attributes (values cascade)
      await this.variantAttributeRepository.delete({ productId: id });

      // Update hasVariants flag
      product.hasVariants = false;

      // If stock is provided, use it; otherwise keep current stock
      if (stock !== undefined) {
        product.stock = stock;
      }
    } else if (product.hasVariants) {
      // Product has variants but not updating them
      // Stock should not be updated manually - it's calculated from variants
      // Remove stock from productData to prevent manual override
      if ('stock' in productData) {
        delete (productData as any).stock;
      }
    }

    // Check if seller has payment restrictions (frozen) before allowing status changes to ACTIVE
    const sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    const isFrozen = sellerSettings?.paymentRestricted || false;
    const originalStatus = product.status;

    // Update stock status if stock is being updated (only for non-variant products)
    if (stock !== undefined && !product.hasVariants) {
      if (stock === 0 && product.status === ProductStatus.ACTIVE) {
        product.status = ProductStatus.OUT_OF_STOCK;
      } else if (stock > 0 && product.status === ProductStatus.OUT_OF_STOCK) {
        // Only allow status change to ACTIVE if seller is not frozen
        if (!isFrozen) {
          product.status = ProductStatus.ACTIVE;
        }
        // If frozen, keep status as OUT_OF_STOCK (don't change to ACTIVE)
      }
      product.stock = stock;
    }

    // Handle salePriceExpiresAt update if provided
    if (updateProductDto.salePriceExpiresAt !== undefined) {
      product.salePriceExpiresAt = updateProductDto.salePriceExpiresAt
        ? new Date(updateProductDto.salePriceExpiresAt)
        : null;
    }

    // Handle price updates (regularPrice, salePrice, or legacy price)
    if (
      updateProductDto.regularPrice !== undefined ||
      updateProductDto.salePrice !== undefined ||
      updateProductDto.price !== undefined ||
      updateProductDto.salePriceExpiresAt !== undefined
    ) {
      // Update regularPrice if provided, otherwise keep existing or use price
      if (updateProductDto.regularPrice !== undefined) {
        product.regularPrice = updateProductDto.regularPrice;
      } else if (updateProductDto.price !== undefined && !product.regularPrice) {
        // If price is provided and regularPrice doesn't exist, set it
        product.regularPrice = updateProductDto.price;
      }

      // Update salePrice if provided
      if (updateProductDto.salePrice !== undefined) {
        product.salePrice = updateProductDto.salePrice;
      }

      // Determine effective price: salePrice if on sale and not expired, otherwise regularPrice, fallback to price
      const effectivePrice = this.getEffectivePrice(
        product.salePrice,
        product.regularPrice,
        updateProductDto.price,
        product.salePriceExpiresAt,
      );

      if (effectivePrice !== null && effectivePrice !== undefined) {
        product.price = effectivePrice; // Update legacy price field for backward compatibility
        product.basePrice = effectivePrice; // Update basePrice
        // baseCurrency should remain the same (determined by seller's market)
      }
    }

    let imagesRequireReapproval = false;
    // Handle image cleanup if images are being updated
    if (updateProductDto.images !== undefined) {
      // Normalize oldImages using helper function (always returns array)
      const oldImages = this.normalizeImages(product.images);

      const newImages = updateProductDto.images;

      // Validate newImages is an array
      if (!Array.isArray(newImages)) {
        throw new BadRequestException('Images must be an array');
      }

      imagesRequireReapproval =
        userType !== UserType.ADMIN &&
        !this.areImageListsEqual(oldImages, newImages);

      // Find images that are being removed (old images not in new array)
      const imagesToDelete = oldImages.filter(
        (oldUrl) => !newImages.includes(oldUrl),
      );

      // Delete removed images from Cloudinary
      if (imagesToDelete.length > 0) {
        try {
          const publicIds = imagesToDelete
            .map((url) => this.cloudinaryService.extractPublicIdFromUrl(url))
            .filter((id): id is string => id !== null);

          if (publicIds.length > 0) {
            await this.cloudinaryService.deleteMultipleImages(publicIds);
          }
        } catch (error) {
          // Log error but don't fail product update if deletion fails
          console.error(
            `Failed to delete old images for product ${id}:`,
            error,
          );
        }
      }
    }

    Object.assign(product, productData);

    if (imagesRequireReapproval) {
      await this.applyImageChangeReapproval(
        product,
        'Product Pending Approval',
        `Product "${product.name}" had its images updated and needs approval again`,
      );
    }

    // Explicitly apply categoryId when provided so the loaded category relation does not override it on save
    if (updateProductDto.categoryId !== undefined) {
      product.categoryId = updateProductDto.categoryId ?? null;
      product.category = undefined as any; // Clear relation so TypeORM persists categoryId
    }

    // Prevent frozen sellers from activating products (status should not change to ACTIVE)
    // Allow status to remain ACTIVE if it was already ACTIVE (don't force deactivate existing active products)
    if (
      isFrozen &&
      product.status === ProductStatus.ACTIVE &&
      originalStatus !== ProductStatus.ACTIVE
    ) {
      // Product status was changed to ACTIVE but seller is frozen - prevent activation
      product.status = originalStatus; // Revert to original status
      throw new BadRequestException(
        'Cannot activate products. Account is frozen due to overdue invoices. Please pay outstanding invoices to continue.',
      );
    }

    // If product was previously rejected and seller is updating it,
    // clear rejection fields to indicate it needs re-review
    // The approval status remains false until admin reviews it again
    if (product.rejectionMessage || product.rejectedAt) {
      product.rejectionMessage = null;
      product.rejectedAt = null;
    }

    // Note: Seller image updates reset approval (see imagesRequireReapproval). Admin updates do not.
    // If a rejected product is updated, it remains unapproved and needs re-review

    // Save product first (without variant relations)
    let updatedProduct: Product;
    try {
      updatedProduct = await this.productsRepository.save(product);
    } catch (err) {
      const pg = err instanceof QueryFailedError ? (err as any).driverError ?? err : null;
      const code = pg?.code ?? (err as any)?.code;
      const constraint = pg?.constraint ?? (err as any)?.constraint;
      if (code === '23505' && (constraint === 'UQ_products_sku' || constraint === 'UQ_products_sellerId_sku')) {
        throw new BadRequestException(
          'A product with this SKU already exists in your store. Please use a different SKU.',
        );
      }
      throw err;
    }

    // Now create/update variants if provided (after product is saved)
    if (variantAttributes && variants) {
      // Get remaining existing variants (after deletion) to update them instead of creating duplicates
      const remainingExistingVariants = await this.variantRepository.find({
        where: { productId: id },
      });
      const existingVariantsMap = new Map<string, ProductVariant>();
      for (const variant of remainingExistingVariants) {
        const normalizedCombination = this.normalizeCombination(
          variant.combination,
        );
        existingVariantsMap.set(normalizedCombination, variant);
      }
      await this.createVariantAttributes(
        id,
        variantAttributes,
        variants,
        existingVariantsMap,
      );
    }

    // Reload with all relations including variants
    return this.productsRepository.findOneOrFail({
      where: { id: updatedProduct.id },
      relations: [
        'category',
        'variantAttributes',
        'variantAttributes.values',
        'variants',
      ],
    });
  }

  async remove(
    id: string,
    sellerId: string,
    userType?: UserType,
  ): Promise<void> {
    const product = await this.findOne(id, sellerId, userType);

    // Check if product has any order items
    const orderItemsCount = await this.orderItemRepository.count({
      where: { productId: id },
    });

    if (orderItemsCount > 0) {
      // Product has orders - soft delete by setting status to INACTIVE
      // This preserves order history while effectively removing the product from the store
      product.status = ProductStatus.INACTIVE;
      await this.productsRepository.save(product);
    } else {
      // No orders - safe to hard delete
      // Delete all images from Cloudinary before removing product
      
      // Collect all images to delete (product images + variant images)
      const allImagesToDelete: string[] = [];
      
      // Add product images
      const productImages = this.normalizeImages(product.images);
      allImagesToDelete.push(...productImages);
      
      // Add variant images if product has variants
      if (product.hasVariants && product.variants) {
        for (const variant of product.variants) {
          if (variant.images && Array.isArray(variant.images)) {
            allImagesToDelete.push(...variant.images);
          }
        }
      }
      
      // Delete all images from Cloudinary
      if (allImagesToDelete.length > 0) {
        try {
          const publicIds = allImagesToDelete
            .map((url) => {
              const publicId = this.cloudinaryService.extractPublicIdFromUrl(url);
              if (!publicId) {
                console.warn(`Could not extract public ID from URL: ${url}`);
              }
              return publicId;
            })
            .filter((id): id is string => id !== null && id !== undefined);

          if (publicIds.length > 0) {
            await this.cloudinaryService.deleteMultipleImages(publicIds);
          } else {
            console.warn(
              `No valid public IDs extracted from ${allImagesToDelete.length} image URL(s) for product ${id}`,
            );
          }
        } catch (error) {
          // Log error but don't fail product deletion if image deletion fails
          console.error(`Failed to delete images for product ${id}:`, error);
        }
      }

      await this.productsRepository.remove(product);
    }
  }

  async updateImages(
    id: string,
    sellerId: string,
    images: string[],
    userType?: UserType,
  ): Promise<Product> {
    const product = await this.findOne(id, sellerId, userType);

    // Normalize oldImages using helper function (always returns array)
    const oldImages = this.normalizeImages(product.images);
    
    // Validate images parameter is an array
    if (!Array.isArray(images)) {
      throw new BadRequestException('Images must be an array');
    }
    
    // Find images that are being removed (old images not in new array)
    const imagesToDelete = oldImages.filter(
      (oldUrl) => !images.includes(oldUrl),
    );

    // Delete removed images from Cloudinary
    if (imagesToDelete.length > 0) {
      try {
        const publicIds = imagesToDelete
          .map((url) => this.cloudinaryService.extractPublicIdFromUrl(url))
          .filter((id): id is string => id !== null);

        if (publicIds.length > 0) {
          await this.cloudinaryService.deleteMultipleImages(publicIds);
        }
      } catch (error) {
        // Log error but don't fail image update if deletion fails
        console.error(`Failed to delete old images for product ${id}:`, error);
      }
    }

    product.images = images;

    const imagesChanged = !this.areImageListsEqual(oldImages, images);
    if (imagesChanged && userType !== UserType.ADMIN) {
      await this.applyImageChangeReapproval(
        product,
        'Product Pending Approval',
        `Product "${product.name}" had its images updated and needs approval again`,
      );
    }

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
      sortBy = 'trending',
      onSale,
      minPrice,
      maxPrice,
      minRating,
      inStock,
      categories: categoriesParam,
      minCommission,
      maxCommission,
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
      .andWhere(
        '(sellerSettings.paymentRestricted IS NULL OR sellerSettings.paymentRestricted = false)',
      ) // Exclude products from sellers with payment restrictions
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.andWhere('product.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    // Category filter: multiple (categories) or single (category)
    const categoryIds =
      categoriesParam?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
    if (categoryIds.length > 0) {
      queryBuilder.andWhere(
        '(product.categoryId IN (:...categoryIds) OR category.parentId IN (:...categoryIds))',
        { categoryIds },
      );
    } else if (category) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: category,
      });
    }

    if (sellerId) {
      queryBuilder.andWhere('product.sellerId = :sellerId', {
        sellerId,
      });
    }

    // Filter by sale status
    if (onSale !== undefined) {
      if (onSale === true) {
        // Only products with active sale price (not expired)
        queryBuilder.andWhere('product.salePrice IS NOT NULL')
          .andWhere(
            '(product.salePriceExpiresAt IS NULL OR product.salePriceExpiresAt > :now)',
            { now: new Date() },
          );
      } else {
        // Only products without active sale price
        queryBuilder.andWhere(
          '(product.salePrice IS NULL OR (product.salePriceExpiresAt IS NOT NULL AND product.salePriceExpiresAt <= :now))',
          { now: new Date() },
        );
      }
    }

    // Price range (effective price in MKD: sale if valid, else regular/base/price; convert EUR to MKD for filtering)
    if (minPrice != null || maxPrice != null) {
      const priceMin = minPrice ?? 0;
      const priceMax = maxPrice ?? 999999999;
      const exchangeRate = this.currencyService.getExchangeRate();
      queryBuilder.andWhere(
        `(
          CASE
            WHEN COALESCE(product.baseCurrency, 'MKD') = 'EUR'
            THEN (CASE WHEN (product.salePrice IS NOT NULL AND (product.salePriceExpiresAt IS NULL OR product.salePriceExpiresAt > :priceNow)) THEN product.salePrice ELSE COALESCE(product.regularPrice, product.basePrice, product.price) END) * :exchangeRate
            ELSE (CASE WHEN (product.salePrice IS NOT NULL AND (product.salePriceExpiresAt IS NULL OR product.salePriceExpiresAt > :priceNow)) THEN product.salePrice ELSE COALESCE(product.regularPrice, product.basePrice, product.price) END)
          END
        ) BETWEEN :priceMin AND :priceMax`,
        { priceNow: new Date(), priceMin, priceMax, exchangeRate },
      );
    }

    // Minimum rating
    if (minRating != null && minRating > 0) {
      queryBuilder.andWhere('product.rating >= :minRating', { minRating });
    }

    // In stock only
    if (inStock === true) {
      queryBuilder.andWhere('product.stock > 0');
    }

    // Affiliate commission range (for affiliate product listing)
    if (minCommission != null && minCommission > 0) {
      queryBuilder.andWhere('product.affiliateCommission >= :minCommission', {
        minCommission,
      });
    }
    if (
      maxCommission != null &&
      maxCommission <= 100 &&
      (minCommission == null || maxCommission >= minCommission)
    ) {
      queryBuilder.andWhere('product.affiliateCommission <= :maxCommission', {
        maxCommission,
      });
    }

    // Apply sorting ('popular' is alias for trending; 'sales' orders by sales only)
    const trendOrder = () =>
      queryBuilder
        .orderBy('product.sales', 'DESC')
        .addOrderBy('product.views', 'DESC')
        .addOrderBy('product.createdAt', 'DESC');
    switch (sortBy) {
      case 'popular':
      case 'trending':
        trendOrder();
        break;
      case 'sales':
        queryBuilder
          .orderBy('product.sales', 'DESC')
          .addOrderBy('product.createdAt', 'DESC');
        break;
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
      case 'commission_asc':
        queryBuilder.orderBy('product.affiliateCommission', 'ASC');
        break;
      case 'commission_desc':
        queryBuilder.orderBy('product.affiliateCommission', 'DESC');
        break;
      case 'stock_asc':
        queryBuilder.orderBy('product.stock', 'ASC');
        break;
      case 'stock_desc':
        queryBuilder.orderBy('product.stock', 'DESC');
        break;
      case 'rating_desc':
        queryBuilder
          .orderBy('product.rating', 'DESC')
          .addOrderBy('product.reviewsCount', 'DESC')
          .addOrderBy('product.createdAt', 'DESC');
        break;
      case 'created_at_desc':
        queryBuilder.orderBy('product.createdAt', 'DESC');
        break;
      default:
        trendOrder();
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

    // Normalize prices to handle expired sale prices
    const normalizedProducts = this.normalizeProductPrices(products);

    // Map products to include storeName from sellerSettings
    const productsWithStore = normalizedProducts.map((product) => {
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

  /**
   * Active approved marketplace products with variants loaded — for Meta / Google catalog feeds.
   */
  async findAllForMetaCatalogFeed(
    page: number,
    limit: number,
    filters?: MetaCatalogFeedFilters,
  ): Promise<{
    products: Product[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('category.parent', 'categoryParent')
      .leftJoinAndSelect('product.seller', 'seller')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoin(
        SellerSettings,
        'sellerSettings',
        'sellerSettings.sellerId = product.sellerId',
      )
      .addSelect(['sellerSettings.storeName', 'sellerSettings.logo'])
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.approved = :approved', { approved: true })
      .andWhere(
        '(sellerSettings.paymentRestricted IS NULL OR sellerSettings.paymentRestricted = false)',
      )
      .orderBy('product.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const categoriesParam = filters?.categories?.trim();
    const categoryIds =
      categoriesParam
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    if (categoryIds.length > 0) {
      queryBuilder.andWhere(
        '(product.categoryId IN (:...categoryIds) OR category.parentId IN (:...categoryIds))',
        { categoryIds },
      );
    } else if (filters?.category?.trim()) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: filters.category.trim(),
      });
    }

    const multiSellerIds =
      filters?.sellerIds
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    if (multiSellerIds.length > 0) {
      queryBuilder.andWhere('product.sellerId IN (:...multiSellerIds)', {
        multiSellerIds,
      });
    } else if (filters?.sellerId?.trim()) {
      queryBuilder.andWhere('product.sellerId = :sellerId', {
        sellerId: filters.sellerId.trim(),
      });
    }

    const [products, total] = await queryBuilder.getManyAndCount();

    const sellerIds = [...new Set(products.map((p) => p.sellerId))];
    const sellerSettingsMap = new Map<string, SellerSettings>();
    if (sellerIds.length > 0) {
      const sellerSettings = await this.sellerSettingsRepository.find({
        where: { sellerId: In(sellerIds) },
      });
      sellerSettings.forEach((settings) => {
        sellerSettingsMap.set(settings.sellerId, settings);
      });
    }

    const normalizedProducts = this.normalizeProductPrices(products);
    const productsWithStore = normalizedProducts.map((product) => {
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
      products: productsWithStore as Product[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calculate discount percent for a product with active sale
   */
  private getDiscountPercent(product: Product): number | null {
    if (!this.isSalePriceValid(product.salePrice, product.salePriceExpiresAt)) {
      return null;
    }
    const salePrice =
      product.salePrice != null ? parseFloat(String(product.salePrice)) : null;
    if (salePrice == null) return null;

    const regularPrice =
      product.regularPrice != null
        ? parseFloat(String(product.regularPrice))
        : product.basePrice != null
          ? parseFloat(String(product.basePrice))
          : product.price != null
            ? parseFloat(String(product.price))
            : null;

    if (regularPrice == null || salePrice >= regularPrice) return null;
    return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
  }

  /**
   * Get all product sections for the landing page in one go.
   * Fetches larger pools per section then deduplicates in priority order
   * (flashDeals → trending → hotDeals → bestSellers → newArrivals) so no
   * product appears in more than one section.
   */
  async getLanding(): Promise<{
    flashDeals: Product[];
    trending: Product[];
    hotDeals: Product[];
    bestSellers: Product[];
    newArrivals: Product[];
    maxDiscountPercent: number;
  }> {
    const [flashRes, trendingRes, hotDealsRes, bestSellersRes, newArrivalsRes] =
      await Promise.all([
        this.findAllPublic({ limit: 10, sortBy: 'popular', onSale: true }),
        this.findAllPublic({ limit: 20, sortBy: 'popular' }),
        this.findAllPublic({ limit: 20, sortBy: 'newest', onSale: true }),
        this.findAllPublic({ limit: 25, sortBy: 'sales' }),
        this.findAllPublic({ limit: 15, sortBy: 'newest' }),
      ]);

    const usedIds = new Set<string>();
    const dedupe = (products: Product[], limit: number): Product[] => {
      const unique = products.filter((p) => !usedIds.has(p.id)).slice(0, limit);
      unique.forEach((p) => usedIds.add(p.id));
      return unique;
    };

    const flashDeals = dedupe(flashRes.products, 4);
    const trending = dedupe(trendingRes.products, 8);
    const hotDeals = dedupe(hotDealsRes.products, 8);
    const bestSellers = dedupe(bestSellersRes.products, 10);
    const newArrivals = dedupe(newArrivalsRes.products, 6);

    const allDealProducts = [...flashDeals, ...hotDeals];
    let maxDiscountPercent = 50;
    for (const p of allDealProducts) {
      const percent = this.getDiscountPercent(p);
      if (percent != null && percent > maxDiscountPercent) {
        maxDiscountPercent = percent;
      }
    }

    return {
      flashDeals,
      trending,
      hotDeals,
      bestSellers,
      newArrivals,
      maxDiscountPercent,
    };
  }

  /**
   * Returns a wide pool of currently-on-sale, active, approved products for
   * scoring-based flash deal selection. Only selects the columns needed for
   * scoring to keep the query lightweight.
   */
  async getFlashDealPool(limit = 200): Promise<Product[]> {
    const now = new Date();
    return this.productsRepository
      .createQueryBuilder('product')
      .select([
        'product.id',
        'product.name',
        'product.price',
        'product.regularPrice',
        'product.salePrice',
        'product.salePriceExpiresAt',
        'product.images',
        'product.categoryId',
        'product.rating',
        'product.reviewsCount',
        'product.sales',
        'product.views',
        'product.createdAt',
      ])
      .leftJoin(
        SellerSettings,
        'ss',
        'ss.sellerId = product.sellerId',
      )
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.approved = :approved', { approved: true })
      .andWhere('product.stock > 0')
      .andWhere('product.salePrice IS NOT NULL')
      .andWhere(
        '(product.salePriceExpiresAt IS NULL OR product.salePriceExpiresAt > :now)',
        { now },
      )
      .andWhere(
        '(ss.paymentRestricted IS NULL OR ss.paymentRestricted = false)',
      )
      .limit(limit)
      .getMany();
  }

  async findOnePublic(id: string, incrementView = true): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id, status: ProductStatus.ACTIVE, approved: true },
      relations: [
        'category',
        'seller',
        'variantAttributes',
        'variantAttributes.values',
        'variants',
      ],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Increment view count only for actual page views (skip for metadata/SEO fetches to avoid duplicates)
    if (incrementView) {
      await this.productsRepository.increment({ id }, 'views', 1);
    }

    // Reload product to get updated views count
    let updatedProduct = await this.productsRepository.findOne({
      where: { id },
      relations: [
        'category',
        'seller',
        'variantAttributes',
        'variantAttributes.values',
        'variants',
      ],
    });

    // Normalize price to handle expired sale prices
    updatedProduct = this.normalizeProductPrice(updatedProduct!);

    // Get seller settings to include store name
    const sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId: updatedProduct.sellerId },
    });

    return {
      ...updatedProduct,
      seller: {
        ...updatedProduct.seller,
        storeName: sellerSettings?.storeName || null,
        storeLogo: sellerSettings?.logo || null,
      },
    } as Product;
  }

  /**
   * Normalize combination for comparison (sort keys for consistent comparison)
   */
  private normalizeCombination(combination: Record<string, string>): string {
    return Object.entries(combination)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
  }

  /**
   * Create variant attributes, values, and product variants
   * @param existingVariantsMap - Map of existing variants by normalized combination (for updates)
   */
  private async createVariantAttributes(
    productId: string,
    variantAttributes: CreateProductDto['variantAttributes'],
    variants: CreateProductDto['variants'],
    existingVariantsMap?: Map<string, ProductVariant>,
  ): Promise<void> {
    if (!variantAttributes || !variants) {
      return;
    }

    const attributeMap = new Map<string, ProductVariantAttribute>();
    const valueMap = new Map<string, Map<string, ProductVariantValue>>();

    // Create variant attributes and their values
    for (const attrDto of variantAttributes) {
      const attribute = this.variantAttributeRepository.create({
        productId,
        name: attrDto.name,
        displayOrder: attrDto.displayOrder || 0,
      });
      const savedAttribute =
        await this.variantAttributeRepository.save(attribute);
      attributeMap.set(attrDto.name, savedAttribute);

      // Create values for this attribute
      const valuesMap = new Map<string, ProductVariantValue>();
      for (const valueDto of attrDto.values) {
        const value = this.variantValueRepository.create({
          attributeId: savedAttribute.id,
          value: valueDto.value,
          colorCode: valueDto.colorCode || null,
          displayOrder: valueDto.displayOrder || 0,
        });
        const savedValue = await this.variantValueRepository.save(value);
        valuesMap.set(valueDto.value, savedValue);
      }
      valueMap.set(attrDto.name, valuesMap);
    }

    // Validate and create/update product variants
    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const variantsToInsert: Array<{
      productId: string;
      combination: Record<string, string>;
      combinationDisplay: string;
      stock: number;
      price: number | null;
      sku: string | null;
      images: string[] | null;
      isActive: boolean;
    }> = [];

    const variantsToUpdate: Array<{
      id: string;
      combination: Record<string, string>;
      combinationDisplay: string;
      stock: number;
      price: number | null;
      sku: string | null;
      images: string[] | null;
      isActive: boolean;
    }> = [];

    for (const variantDto of variants) {
      // Validate combination - all attribute names must exist
      for (const attrName of Object.keys(variantDto.combination)) {
        if (!attributeMap.has(attrName)) {
          throw new BadRequestException(
            `Invalid attribute name in variant combination: ${attrName}`,
          );
        }
        const attrValue = variantDto.combination[attrName];
        const valuesForAttr = valueMap.get(attrName);
        if (!valuesForAttr || !valuesForAttr.has(attrValue)) {
          throw new BadRequestException(
            `Invalid value "${attrValue}" for attribute "${attrName}"`,
          );
        }
      }

      // Create display string for combination
      const combinationDisplay = Object.entries(variantDto.combination)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistent display
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      // Ensure combinationDisplay is never empty
      if (!combinationDisplay || combinationDisplay.trim() === '') {
        throw new BadRequestException(
          `Invalid variant combination: combinationDisplay cannot be empty`,
        );
      }

      // Check if variant already exists
      const normalizedCombination = this.normalizeCombination(
        variantDto.combination,
      );
      const existingVariant = existingVariantsMap?.get(normalizedCombination);

      if (existingVariant) {
        // Update existing variant
        variantsToUpdate.push({
          id: existingVariant.id,
          combination: variantDto.combination,
          combinationDisplay: combinationDisplay.trim(),
          stock: variantDto.stock,
          price: variantDto.price ?? null,
          sku: variantDto.sku || null,
          images: variantDto.images || null,
          isActive: variantDto.isActive ?? true,
        });
      } else {
        // Create new variant
        variantsToInsert.push({
          productId,
          combination: variantDto.combination,
          combinationDisplay: combinationDisplay.trim(),
          stock: variantDto.stock,
          price: variantDto.price ?? null,
          sku: variantDto.sku || null,
          images: variantDto.images || null,
          isActive: variantDto.isActive ?? true,
        });
      }
    }

    // Update existing variants
    for (const variantUpdate of variantsToUpdate) {
      await this.variantRepository.update(
        { id: variantUpdate.id },
        {
          combination: variantUpdate.combination,
          combinationDisplay: variantUpdate.combinationDisplay,
          stock: variantUpdate.stock,
          price: variantUpdate.price,
          sku: variantUpdate.sku,
          images: variantUpdate.images,
          isActive: variantUpdate.isActive,
        },
      );
    }

    // Insert new variants
    if (variantsToInsert.length > 0) {
      await this.variantRepository.insert(variantsToInsert);
    }

    // Update product total stock
    await this.productsRepository.update(productId, { stock: totalStock });
  }
}
