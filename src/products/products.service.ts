import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product, ProductStatus } from './entities/product.entity';
import { ProductVariantAttribute } from './entities/product-variant-attribute.entity';
import { ProductVariantValue } from './entities/product-variant-value.entity';
import { ProductVariant } from './entities/product-variant.entity';
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
import { CurrencyService, Market } from '../common/currency/currency.service';
import { OrderItem } from '../orders/entities/order-item.entity';
import { PlatformSettingsService } from '../platform/platform-settings.service';

@Injectable()
export class ProductsService {
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
      const minCommission = await this.platformSettingsService.getAffiliateCommissionMin();
      const maxCommission = await this.platformSettingsService.getAffiliateCommissionMax();
      
      if (createProductDto.affiliateCommission < minCommission || 
          createProductDto.affiliateCommission > maxCommission) {
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

    // If product has variants, stock will be calculated from variants
    // Otherwise, use the provided stock
    const product = this.productsRepository.create({
      ...productData,
      sellerId,
      basePrice: createProductDto.price, // Set base price from provided price
      baseCurrency: baseCurrency as string, // Set base currency based on seller's market
      approved: isVerified, // Auto-approve if seller is verified
      status: isVerified ? ProductStatus.ACTIVE : ProductStatus.INACTIVE, // Set to inactive if not approved
      hasVariants,
      // If has variants, stock will be calculated from variants
      stock: hasVariants ? 0 : createProductDto.stock,
    });

    const savedProduct = await this.productsRepository.save(product);

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
    queryBuilder.leftJoinAndSelect(
      'product.variantAttributes',
      'variantAttributes',
    );
    queryBuilder.leftJoinAndSelect('variantAttributes.values', 'variantValues');
    queryBuilder.leftJoinAndSelect('product.variants', 'variants');

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
      relations: [
        'category',
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

    return product;
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
      const minCommission = await this.platformSettingsService.getAffiliateCommissionMin();
      const maxCommission = await this.platformSettingsService.getAffiliateCommissionMax();
      
      if (updateProductDto.affiliateCommission < minCommission || 
          updateProductDto.affiliateCommission > maxCommission) {
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

    // If price is being updated, also update basePrice
    if (updateProductDto.price !== undefined) {
      product.basePrice = updateProductDto.price;
      // baseCurrency should remain the same (determined by seller's market)
    }

    Object.assign(product, productData);

    // Prevent frozen sellers from activating products (status should not change to ACTIVE)
    // Allow status to remain ACTIVE if it was already ACTIVE (don't force deactivate existing active products)
    if (isFrozen && product.status === ProductStatus.ACTIVE && originalStatus !== ProductStatus.ACTIVE) {
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

    // Note: Updating an existing product doesn't change its approval status
    // Only new products require approval (unless seller is verified)
    // If a rejected product is updated, it remains unapproved and needs re-review

    // Save product first (without variant relations)
    const updatedProduct = await this.productsRepository.save(product);

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
