import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CustomerOrderQueryDto } from './dto/customer-order-query.dto';
import { User, UserType } from '../users/entities/user.entity';
import { AffiliateService } from '../affiliate/affiliate.service';
import { SellerSettingsService } from '../seller/seller-settings.service';
import { TelegramNotificationService } from '../seller/telegram-notification.service';
import { forwardRef, Inject } from '@nestjs/common';
import { AVAILABLE_SHIPPING_COUNTRIES } from '../common/enums/shipping-countries.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../notifications/entities/notification.entity';
import { EmailVerificationService } from '../auth/services/email-verification.service';
import { EmailService } from '../auth/services/email.service';
import { CustomerService } from '../customer/customer.service';
import {
  CurrencyService,
  Currency,
  Market,
} from '../common/currency/currency.service';

@Injectable()
export class OrdersService {
  private logger: Logger;

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private productVariantRepository: Repository<ProductVariant>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => AffiliateService))
    private affiliateService: AffiliateService,
    @Inject(forwardRef(() => SellerSettingsService))
    private sellerSettingsService: SellerSettingsService,
    @Inject(forwardRef(() => TelegramNotificationService))
    private telegramNotificationService: TelegramNotificationService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
    @Inject(forwardRef(() => EmailVerificationService))
    private emailVerificationService: EmailVerificationService,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
    @Inject(forwardRef(() => CustomerService))
    private customerService: CustomerService,
    private currencyService: CurrencyService,
  ) {
    this.logger = new Logger(OrdersService.name);
  }

  async findAll(
    sellerId: string,
    query: OrderQueryDto,
  ): Promise<{ orders: Order[]; pagination: any }> {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.sellerId = :sellerId', { sellerId })
      .skip(skip)
      .take(limit)
      .orderBy('order.createdAt', 'DESC');

    if (status && status !== 'all') {
      // Map string status to enum value
      const statusMap: Record<string, OrderStatus> = {
        pending: OrderStatus.PENDING,
        processing: OrderStatus.PROCESSING,
        in_transit: OrderStatus.IN_TRANSIT,
        delivered: OrderStatus.DELIVERED,
        cancelled: OrderStatus.CANCELLED,
        returned: OrderStatus.RETURNED,
      };
      const orderStatus = statusMap[status.toLowerCase()];
      if (orderStatus) {
        queryBuilder.andWhere('order.status = :status', {
          status: orderStatus,
        });
      }
    }

    if (dateFrom && dateTo) {
      queryBuilder.andWhere('order.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom,
        dateTo,
      });
    } else if (dateFrom) {
      queryBuilder.andWhere('order.createdAt >= :dateFrom', { dateFrom });
    } else if (dateTo) {
      queryBuilder.andWhere('order.createdAt <= :dateTo', { dateTo });
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      orders: orders.map((order) => this.formatOrder(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, sellerId: string): Promise<any> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['customer', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.sellerId !== sellerId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return this.formatOrder(order);
  }

  async updateStatus(
    id: string,
    sellerId: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<any> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['customer', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.sellerId !== sellerId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    // Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
      [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
      [OrderStatus.DELIVERED]: [], // Final state
      [OrderStatus.CANCELLED]: [], // Final state
      [OrderStatus.RETURNED]: [], // Final state
    };

    const allowedNextStatuses = validTransitions[order.status];
    if (
      allowedNextStatuses.length > 0 &&
      !allowedNextStatuses.includes(updateOrderStatusDto.status)
    ) {
      throw new BadRequestException(
        `Cannot change status from ${order.status} to ${updateOrderStatusDto.status}. Valid transitions: ${allowedNextStatuses.join(', ')}`,
      );
    }

    // Check if trying to change from final state
    if (allowedNextStatuses.length === 0) {
      throw new BadRequestException(
        `Order status ${order.status} is final and cannot be changed`,
      );
    }

    order.status = updateOrderStatusDto.status;
    // Update tracking ID if provided (optional)
    if (updateOrderStatusDto.trackingId) {
      order.trackingId = updateOrderStatusDto.trackingId;
    }
    // Update status explanation if provided (required for cancelled/returned)
    if (updateOrderStatusDto.statusExplanation !== undefined) {
      order.statusExplanation = updateOrderStatusDto.statusExplanation;
    } else if (
      updateOrderStatusDto.status === OrderStatus.CANCELLED ||
      updateOrderStatusDto.status === OrderStatus.RETURNED
    ) {
      // Clear explanation if status changed from cancelled/returned to something else
      order.statusExplanation = null;
    }

    const updatedOrder = await this.ordersRepository.save(order);

    // Update affiliate commission status based on order status
    if (order.affiliateId) {
      try {
        await this.affiliateService.updateCommissionStatus(
          order.id,
          updateOrderStatusDto.status,
        );
      } catch (error) {
        // Log error but don't fail status update
        console.error('Failed to update affiliate commission status:', error);
      }
    }

    // Send Telegram notification for status changes (especially cancelled/returned)
    if (
      updateOrderStatusDto.status === OrderStatus.CANCELLED ||
      updateOrderStatusDto.status === OrderStatus.RETURNED
    ) {
      try {
        const sellerSettings =
          await this.sellerSettingsService.getSellerShippingCountries(sellerId);

        if (
          sellerSettings?.telegramChatId &&
          sellerSettings.notificationsOrders
        ) {
          // Reload order with relations for notification
          const orderForNotification = await this.ordersRepository.findOne({
            where: { id: updatedOrder.id },
            relations: ['customer', 'items'],
          });
          if (orderForNotification) {
            await this.telegramNotificationService.sendOrderNotification(
              sellerSettings.telegramChatId,
              orderForNotification,
            );
          }
        }
      } catch (error) {
        // Log error but don't fail status update
        console.error(
          `Failed to send Telegram notification for order ${updatedOrder.orderNumber} status change:`,
          error,
        );
      }
    }

    // Send web notification for status changes
    // Only notify the customer - seller initiated the update, so they don't need a notification
    try {
      let notificationType: NotificationType;
      if (updateOrderStatusDto.status === OrderStatus.CANCELLED) {
        notificationType = NotificationType.ORDER_CANCELLED;
      } else if (updateOrderStatusDto.status === OrderStatus.DELIVERED) {
        notificationType = NotificationType.ORDER_COMPLETED;
      } else {
        notificationType = NotificationType.ORDER_UPDATED;
      }

      const notificationMetadata = {
        newStatus: updateOrderStatusDto.status,
        trackingId: updateOrderStatusDto.trackingId,
      };

      // Only notify customer (seller is the one updating, so they don't need notification)
      // Also check that customer is not the same as seller (edge case)
      if (updatedOrder.customerId && updatedOrder.customerId !== sellerId) {
        const customerNotification =
          await this.notificationsService.createOrderNotification(
            updatedOrder.customerId,
            notificationType,
            updatedOrder.id,
            updatedOrder.orderNumber,
            notificationMetadata,
            true, // isCustomer = true
          );
        await this.notificationsGateway.sendNotificationToUser(
          updatedOrder.customerId,
          customerNotification,
        );
      }
    } catch (error) {
      // Log error but don't fail status update
      console.error(
        `Failed to send web notification for order ${updatedOrder.orderNumber} status change:`,
        error,
      );
    }

    // Send email notifications for status changes
    try {
      const customer = await this.usersRepository.findOne({
        where: { id: updatedOrder.customerId },
      });

      if (customer?.email) {
        // Send shipping notification for in_transit or delivered
        if (
          updateOrderStatusDto.status === OrderStatus.IN_TRANSIT ||
          updateOrderStatusDto.status === OrderStatus.DELIVERED
        ) {
          await this.emailService.sendShippingNotification(
            customer.email,
            updatedOrder.orderNumber,
            updateOrderStatusDto.status,
            updateOrderStatusDto.trackingId || undefined,
          );
        }

        // Send cancellation/return email
        if (
          updateOrderStatusDto.status === OrderStatus.CANCELLED ||
          updateOrderStatusDto.status === OrderStatus.RETURNED
        ) {
          await this.emailService.sendOrderCancellationOrReturn(
            customer.email,
            updatedOrder.orderNumber,
            updateOrderStatusDto.status === OrderStatus.CANCELLED
              ? 'cancelled'
              : 'returned',
            updatedOrder.statusExplanation || undefined,
          );
        }
      }
    } catch (error) {
      // Log error but don't fail status update
      console.error(
        `Failed to send email notification for order ${updatedOrder.orderNumber} status change:`,
        error,
      );
    }

    return this.formatOrder(updatedOrder);
  }

  // Generate unique order number
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  // Helper method to group cart items by sellerId
  private async groupItemsBySeller(
    items: Array<{ productId: string; variantId?: string; quantity: number }>,
  ): Promise<
    Map<
      string,
      Array<{ productId: string; variantId?: string; quantity: number }>
    >
  > {
    const itemsBySeller = new Map<
      string,
      Array<{ productId: string; variantId?: string; quantity: number }>
    >();

    for (const item of items) {
      // Fetch product to get sellerId
      const product = await this.productsRepository.findOne({
        where: { id: item.productId },
        select: ['id', 'sellerId'],
      });

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }

      // Group by seller
      if (!itemsBySeller.has(product.sellerId)) {
        itemsBySeller.set(product.sellerId, []);
      }
      itemsBySeller.get(product.sellerId)!.push(item);
    }

    return itemsBySeller;
  }

  // Create new order (supports guest orders and multi-seller carts)
  async create(
    customerId: string | null,
    createOrderDto: CreateOrderDto,
  ): Promise<any> {
    const {
      items,
      shippingAddress,
      trackingId,
      customer,
      customerId: providedCustomerId,
      referralCode,
      affiliateId,
      verificationToken,
    } = createOrderDto;

    // Validate email verification token (required for guest orders, optional for authenticated users)
    let verifiedEmail: string | null = null;

    // If user is not authenticated (no customerId), verification token is required
    if (!providedCustomerId && !customerId) {
      // Check if email is already verified
      const isEmailVerified =
        await this.emailVerificationService.isEmailVerified(customer.email);

      if (isEmailVerified) {
        // Email is already verified, use it directly
        verifiedEmail = customer.email;
      } else {
        // Email not verified, require verification token
        if (!verificationToken) {
          throw new BadRequestException(
            'Verification token is required for guest orders with unverified email',
          );
        }

        try {
          const verification =
            await this.emailVerificationService.validateVerificationToken(
              verificationToken,
            );
          verifiedEmail = verification.email;

          // Ensure email matches customer email
          if (verifiedEmail !== customer.email) {
            throw new BadRequestException(
              'Verification token email does not match customer email',
            );
          }
        } catch (error) {
          if (
            error instanceof BadRequestException ||
            error instanceof UnauthorizedException
          ) {
            throw error;
          }
          throw new UnauthorizedException(
            'Invalid or expired verification token',
          );
        }
      }
    } else if (verificationToken) {
      // If authenticated user provides token, validate it but don't require it
      try {
        const verification =
          await this.emailVerificationService.validateVerificationToken(
            verificationToken,
          );
        verifiedEmail = verification.email;
      } catch (error) {
        // Log but don't fail for authenticated users
        console.warn(
          'Verification token validation failed for authenticated user:',
          error,
        );
      }
    }

    // Determine customer ID - use provided customerId, then authenticated customerId, or create/find guest user
    let finalCustomerId: string;

    if (providedCustomerId) {
      // Use provided customer ID (for authenticated users)
      finalCustomerId = providedCustomerId;
    } else if (customerId) {
      // Use authenticated user ID
      finalCustomerId = customerId;
    } else {
      // Guest order - find or create guest user
      let guestUser = await this.usersRepository.findOne({
        where: { email: customer.email },
      });

      if (!guestUser) {
        // Create guest user with a random password (they can't login)
        const randomPassword = Math.random().toString(36).slice(-12);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        guestUser = this.usersRepository.create({
          email: customer.email,
          name: customer.name,
          password: hashedPassword,
          userType: UserType.CUSTOMER, // Guest users are customers
        });
        guestUser = await this.usersRepository.save(guestUser);
      }

      finalCustomerId = guestUser.id;
    }

    // Group items by seller
    const itemsBySeller = await this.groupItemsBySeller(items);

    this.logger.log(
      `Creating orders for ${itemsBySeller.size} seller(s) from cart with ${items.length} items`,
    );

    // Create orders for each seller
    const createdOrders: any[] = [];
    const errors: Array<{ sellerId: string; error: string }> = [];

    for (const [sellerId, sellerItems] of itemsBySeller.entries()) {
      try {
        const order = await this.createOrderForSeller(
          sellerId,
          sellerItems,
          finalCustomerId,
          shippingAddress,
          customer,
          trackingId,
          referralCode,
          affiliateId,
        );
        createdOrders.push(order);
      } catch (error) {
        // Log error but continue processing other sellers
        this.logger.error(
          `Failed to create order for seller ${sellerId}:`,
          error,
        );
        errors.push({
          sellerId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // If no orders were created successfully, throw error
    if (createdOrders.length === 0) {
      throw new BadRequestException(
        `Failed to create any orders. Errors: ${JSON.stringify(errors)}`,
      );
    }

    // Save shipping address for authenticated customers (not guests)
    // Only save if customer is authenticated (providedCustomerId or customerId was set)
    if (providedCustomerId || customerId) {
      try {
        const customerIdToUse = providedCustomerId || customerId;
        if (customerIdToUse) {
          // Check if customer has any addresses
          const existingAddresses =
            await this.customerService.getAddresses(customerIdToUse);

          // If no addresses exist, save the shipping address as default (first address)
          // If addresses exist, save as non-default (or allow user preference)
          const isFirstAddress = existingAddresses.length === 0;

          await this.customerService.createAddress(customerIdToUse, {
            street: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.state,
            zip: shippingAddress.zip,
            country: shippingAddress.country,
            phone: shippingAddress.phone || customer.phone || '',
            isDefault: isFirstAddress, // Set as default only if it's the first address
          });
        }
      } catch (error) {
        // Log error but don't fail order creation
        this.logger.error(
          `Failed to save shipping address for customer:`,
          error,
        );
      }
    }

    // Return created orders summary
    return {
      success: true,
      ordersCreated: createdOrders.length,
      orders: createdOrders,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Create order for a specific seller
  private async createOrderForSeller(
    sellerId: string,
    items: Array<{ productId: string; variantId?: string; quantity: number }>,
    customerId: string,
    shippingAddress: any,
    customer: any,
    trackingId?: string,
    referralCode?: string,
    affiliateId?: string,
  ): Promise<any> {
    // Get seller to determine base currency
    const seller = await this.usersRepository.findOne({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException(`Seller with ID ${sellerId} not found`);
    }

    // Check if seller has payment restrictions (overdue invoices)
    const hasRestriction =
      await this.sellerSettingsService.hasPaymentRestriction(sellerId);
    if (hasRestriction) {
      throw new BadRequestException(
        'Cannot create orders. Seller has overdue invoices. Please pay outstanding invoices to continue.',
      );
    }

    // Determine seller's base currency from market
    const sellerMarket = (seller.market as Market) || Market.MK; // Default to MK if not set
    const sellerBaseCurrency =
      this.currencyService.getBaseCurrencyForMarket(sellerMarket);

    // Determine buyer's currency from shipping address country
    const buyerCurrency = this.currencyService.getBuyerCurrencyFromCountry(
      shippingAddress.country,
    );

    // Lock exchange rate at order creation time
    const exchangeRate = this.currencyService.getExchangeRate();

    // Validate products and calculate totals
    let totalAmount = 0; // Total in buyer currency
    let totalAmountBase = 0; // Total in seller's base currency
    const orderItems: OrderItem[] = [];

    for (const itemDto of items) {
      const product = await this.productsRepository.findOne({
        where: { id: itemDto.productId },
        relations: ['variants'],
      });

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${itemDto.productId} not found`,
        );
      }

      if (product.sellerId !== sellerId) {
        throw new BadRequestException(
          `Product ${itemDto.productId} does not belong to seller ${sellerId}`,
        );
      }

      if (product.status !== 'active') {
        throw new BadRequestException(
          `Product ${product.name} is not available`,
        );
      }

      // Handle variants
      let variant: ProductVariant | null = null;
      let basePrice: number;
      let variantCombination: Record<string, string> | null = null;

      if (product.hasVariants) {
        // Product has variants - variantId is required
        if (!itemDto.variantId) {
          throw new BadRequestException(
            `Product ${product.name} has variants. Please specify a variantId.`,
          );
        }

        variant = await this.productVariantRepository.findOne({
          where: { id: itemDto.variantId, productId: product.id },
        });

        if (!variant) {
          throw new NotFoundException(
            `Variant with ID ${itemDto.variantId} not found for product ${product.name}`,
          );
        }

        if (!variant.isActive) {
          throw new BadRequestException(
            `Variant is not active for product ${product.name}`,
          );
        }

        if (variant.stock < itemDto.quantity) {
          throw new BadRequestException(
            `Insufficient stock for variant. Available: ${variant.stock}, Requested: ${itemDto.quantity}`,
          );
        }

        // Use variant price if set, otherwise use product base price
        basePrice =
          variant.price !== null && variant.price !== undefined
            ? parseFloat(variant.price.toString())
            : product.basePrice !== null && product.basePrice !== undefined
              ? parseFloat(product.basePrice.toString())
              : parseFloat(product.price.toString());

        variantCombination = variant.combination;

        // Update variant stock
        variant.stock -= itemDto.quantity;
        await this.productVariantRepository.save(variant);

        // Update product total stock (sum of all variant stocks)
        const allVariants = await this.productVariantRepository.find({
          where: { productId: product.id },
        });
        const totalVariantStock = allVariants.reduce(
          (sum, v) => sum + v.stock,
          0,
        );
        product.stock = totalVariantStock;
        if (product.stock === 0) {
          product.status = 'out_of_stock' as any;
        }
        await this.productsRepository.save(product);
      } else {
        // Product without variants - variantId should not be provided
        if (itemDto.variantId) {
          throw new BadRequestException(
            `Product ${product.name} does not have variants. Do not specify variantId.`,
          );
        }

        if (product.stock < itemDto.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${itemDto.quantity}`,
          );
        }

        // Get base price - use basePrice if set, otherwise use price (for backward compatibility)
        basePrice =
          product.basePrice !== null && product.basePrice !== undefined
            ? parseFloat(product.basePrice.toString())
            : parseFloat(product.price.toString());

        // Update product stock
        product.stock -= itemDto.quantity;
        if (product.stock === 0) {
          product.status = 'out_of_stock' as any;
        }
        await this.productsRepository.save(product);
      }

      const productBaseCurrency = (product.baseCurrency ||
        sellerBaseCurrency) as string;

      // Ensure product base currency matches seller's base currency
      if (productBaseCurrency !== sellerBaseCurrency) {
        throw new BadRequestException(
          `Product ${product.name} base currency (${productBaseCurrency}) does not match seller's base currency (${sellerBaseCurrency})`,
        );
      }

      // Convert base price to buyer currency
      const priceInBuyerCurrency = this.currencyService.convertAndRound(
        basePrice,
        productBaseCurrency as Currency,
        buyerCurrency,
      );

      // Calculate item totals
      const itemTotalBase = basePrice * itemDto.quantity;
      const itemTotalBuyer = priceInBuyerCurrency * itemDto.quantity;

      totalAmount += itemTotalBuyer;
      totalAmountBase += itemTotalBase;

      const orderItem = this.orderItemsRepository.create({
        productId: product.id,
        productName: product.name,
        quantity: itemDto.quantity,
        price: priceInBuyerCurrency, // Price per unit in buyer currency
        basePrice: basePrice, // Base price per unit in seller currency
        baseCurrency: productBaseCurrency,
        variantId: variant?.id || null,
        variantCombination: variantCombination,
      });

      orderItems.push(orderItem);
    }

    // Round final totals
    totalAmount = this.currencyService.round(totalAmount, buyerCurrency);
    totalAmountBase = this.currencyService.round(
      totalAmountBase,
      sellerBaseCurrency,
    );

    // Validate shipping country - check if seller supports shipping to the requested country
    const shippingCountry = shippingAddress.country;
    const sellerSettings =
      await this.sellerSettingsService.getSellerShippingCountries(sellerId);

    if (sellerSettings) {
      const supportedCountries = sellerSettings.shippingCountries || [];

      // If seller has specific shipping countries set, validate the shipping country
      if (supportedCountries.length > 0) {
        if (!supportedCountries.includes(shippingCountry)) {
          throw new BadRequestException(
            `Seller does not support shipping to ${shippingCountry}. Supported countries: ${supportedCountries.join(', ')}`,
          );
        }
      } else {
        // If seller hasn't set specific countries, check against available countries
        // (This allows flexibility - seller might ship to all or hasn't configured yet)
        if (!AVAILABLE_SHIPPING_COUNTRIES.includes(shippingCountry as any)) {
          throw new BadRequestException(
            `Shipping to ${shippingCountry} is not currently supported. Available countries: ${AVAILABLE_SHIPPING_COUNTRIES.join(', ')}`,
          );
        }
      }
    } else {
      // If seller settings don't exist, validate against available countries
      if (!AVAILABLE_SHIPPING_COUNTRIES.includes(shippingCountry as any)) {
        throw new BadRequestException(
          `Shipping to ${shippingCountry} is not currently supported. Available countries: ${AVAILABLE_SHIPPING_COUNTRIES.join(', ')}`,
        );
      }
    }

    // Handle affiliate referral
    let finalAffiliateId: string | null = null;
    let finalReferralCode: string | null = null;

    if (affiliateId) {
      // Verify affiliate exists
      const affiliateUser = await this.usersRepository.findOne({
        where: { id: affiliateId, userType: UserType.AFFILIATE },
      });
      if (affiliateUser) {
        finalAffiliateId = affiliateId;
      }
    } else if (referralCode) {
      // Look up affiliate by referral code and validate
      try {
        const affiliateUser =
          await this.affiliateService.getAffiliateByReferralCode(referralCode);
        if (affiliateUser && affiliateUser.userType === UserType.AFFILIATE) {
          finalAffiliateId = affiliateUser.id;
          finalReferralCode = referralCode;
        } else {
          // Invalid referral code or affiliate not active
          console.warn(
            `Invalid referral code or inactive affiliate: ${referralCode}`,
          );
          // Don't fail order creation, just log warning
          finalReferralCode = referralCode; // Still save it for tracking
        }
      } catch (error) {
        // Log warning but don't fail order creation
        console.warn(
          `Failed to validate referral code ${referralCode}:`,
          error,
        );
        finalReferralCode = referralCode; // Still save it for tracking
      }
    }

    // Create order - merge phone from customer info into shippingAddress
    // Default payment method is 'cod' (Cash on Delivery)
    const order = this.ordersRepository.create({
      orderNumber: this.generateOrderNumber(),
      sellerId,
      customerId: customerId,
      affiliateId: finalAffiliateId,
      referralCode: finalReferralCode,
      totalAmount, // Total in buyer currency
      totalAmountBase, // Total in seller's base currency
      buyerCurrency: buyerCurrency as string,
      sellerBaseCurrency: sellerBaseCurrency as string,
      exchangeRate, // Locked exchange rate at order time
      status: OrderStatus.PENDING,
      paymentMethod: 'cod', // Default to COD (Cash on Delivery)
      trackingId: trackingId || null,
      shippingAddress: {
        ...shippingAddress,
        phone: shippingAddress.phone || customer.phone, // Use phone from shippingAddress if provided, otherwise from customer
      },
      items: orderItems,
    });

    const savedOrder = await this.ordersRepository.save(order);

    // Create affiliate commissions if affiliate is associated
    if (finalAffiliateId) {
      try {
        await this.affiliateService.createCommissionsForOrder(
          savedOrder.id,
          finalAffiliateId,
        );
      } catch (error) {
        // Log warning but don't fail order creation
        console.warn(
          `Failed to create affiliate commissions for order ${savedOrder.orderNumber}:`,
          error,
        );
      }
    } else if (referralCode) {
      // Referral code was provided but affiliate not found/active
      console.warn(
        `Invalid referral code or inactive affiliate: ${referralCode}. Order created without commissions.`,
      );
    }

    // Send Telegram notification to seller if configured
    try {
      const sellerSettings =
        await this.sellerSettingsService.getSellerShippingCountries(sellerId);

      if (!sellerSettings) {
        console.log(
          `[Order ${savedOrder.orderNumber}] No seller settings found, skipping Telegram notification`,
        );
      } else if (!sellerSettings.telegramChatId) {
        console.log(
          `[Order ${savedOrder.orderNumber}] No Telegram chat ID configured for seller ${sellerId}`,
        );
      } else if (!sellerSettings.notificationsOrders) {
        console.log(
          `[Order ${savedOrder.orderNumber}] Order notifications disabled for seller ${sellerId}`,
        );
      } else {
        console.log(
          `[Order ${savedOrder.orderNumber}] Sending Telegram notification to chat ${sellerSettings.telegramChatId}`,
        );
        // Reload order with relations for notification
        const orderForNotification = await this.ordersRepository.findOne({
          where: { id: savedOrder.id },
          relations: ['customer', 'items'],
        });
        if (orderForNotification) {
          await this.telegramNotificationService.sendOrderNotification(
            sellerSettings.telegramChatId,
            orderForNotification,
          );
        } else {
          console.error(
            `[Order ${savedOrder.orderNumber}] Failed to reload order with relations for notification`,
          );
        }
      }
    } catch (error) {
      // Log error but don't fail order creation
      console.error(
        `[Order ${savedOrder.orderNumber}] Failed to send Telegram notification:`,
        error,
      );
    }

    // Send web notification to seller and customer
    try {
      const notificationMetadata = {
        totalAmount: savedOrder.totalAmount,
        itemCount: savedOrder.items.length,
      };

      // Notify seller (only if seller is not the same as customer)
      if (sellerId !== customerId) {
        const sellerNotification =
          await this.notificationsService.createOrderNotification(
            sellerId,
            NotificationType.ORDER_CREATED,
            savedOrder.id,
            savedOrder.orderNumber,
            notificationMetadata,
            false, // isCustomer = false
          );
        await this.notificationsGateway.sendNotificationToUser(
          sellerId,
          sellerNotification,
        );
      }

      // Notify customer
      if (customerId) {
        const customerNotification =
          await this.notificationsService.createOrderNotification(
            customerId,
            NotificationType.ORDER_CREATED,
            savedOrder.id,
            savedOrder.orderNumber,
            notificationMetadata,
            true, // isCustomer = true
          );
        await this.notificationsGateway.sendNotificationToUser(
          customerId,
          customerNotification,
        );
      }
    } catch (error) {
      // Log error but don't fail order creation
      console.error(
        `[Order ${savedOrder.orderNumber}] Failed to send web notification:`,
        error,
      );
    }

    // Send email notifications
    try {
      // Get customer email (from order or customer entity)
      const customerEmail = customer.email || null;

      // Send order confirmation email to customer
      if (customerEmail) {
        const orderItems = savedOrder.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          price: parseFloat(item.price.toString()),
        }));

        await this.emailService.sendOrderConfirmation(
          customerEmail,
          savedOrder.orderNumber,
          parseFloat(savedOrder.totalAmount.toString()),
          orderItems,
        );
      }

      // Send seller notification email
      const sellerUser = await this.usersRepository.findOne({
        where: { id: sellerId },
      });
      if (sellerUser?.email) {
        await this.emailService.sendSellerNotification(
          sellerUser.email,
          'new_order',
          {
            orderNumber: savedOrder.orderNumber,
            totalAmount: parseFloat(savedOrder.totalAmount.toString()),
          },
        );
      }
    } catch (error) {
      // Log error but don't fail order creation
      console.error(
        `[Order ${savedOrder.orderNumber}] Failed to send email notifications:`,
        error,
      );
    }

    // Reload with relations
    return this.findOnePublic(savedOrder.id);
  }

  // Old create method removed - now using multi-seller approach above

  // Cancel order
  async cancel(
    id: string,
    userId: string,
    userType: 'customer' | 'seller',
    explanation: string,
  ): Promise<any> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['customer', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    if (userType === 'customer' && order.customerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    if (userType === 'seller' && order.sellerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    // Check if order can be cancelled
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot cancel a delivered order');
    }

    if (order.status === OrderStatus.RETURNED) {
      throw new BadRequestException('Order is already returned');
    }

    // Restore product stock
    for (const item of order.items) {
      const product = await this.productsRepository.findOne({
        where: { id: item.productId },
      });
      if (product) {
        product.stock += item.quantity;
        if (product.status === 'out_of_stock' && product.stock > 0) {
          product.status = 'active' as any;
        }
        await this.productsRepository.save(product);
      }
    }

    // Update order status with explanation
    order.status = OrderStatus.CANCELLED;
    order.statusExplanation = explanation;
    const cancelledOrder = await this.ordersRepository.save(order);

    // Update affiliate commission status to cancelled
    if (order.affiliateId) {
      try {
        await this.affiliateService.updateCommissionStatus(
          order.id,
          OrderStatus.CANCELLED,
        );
      } catch (error) {
        // Log error but don't fail cancellation
        console.error('Failed to update affiliate commission status:', error);
      }
    }

    return this.formatOrder(cancelledOrder);
  }

  // Return order
  async returnOrder(
    id: string,
    userId: string,
    userType: 'customer' | 'seller',
    explanation: string,
  ): Promise<any> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['customer', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    if (userType === 'customer' && order.customerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    if (userType === 'seller' && order.sellerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    // Check if order can be returned
    if (order.status === OrderStatus.RETURNED) {
      throw new BadRequestException('Order is already returned');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot return a cancelled order');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    // Restore product stock
    for (const item of order.items) {
      const product = await this.productsRepository.findOne({
        where: { id: item.productId },
      });
      if (product) {
        product.stock += item.quantity;
        if (product.status === 'out_of_stock' && product.stock > 0) {
          product.status = 'active' as any;
        }
        await this.productsRepository.save(product);
      }
    }

    // Update order status with explanation
    order.status = OrderStatus.RETURNED;
    order.statusExplanation = explanation;
    const returnedOrder = await this.ordersRepository.save(order);

    // Update affiliate commission status to returned
    if (order.affiliateId) {
      try {
        await this.affiliateService.updateCommissionStatus(
          order.id,
          OrderStatus.RETURNED,
        );
      } catch (error) {
        // Log error but don't fail return
        console.error('Failed to update affiliate commission status:', error);
      }
    }

    return this.formatOrder(returnedOrder);
  }

  // Search orders (for sellers)
  async search(
    sellerId: string,
    searchTerm: string,
    query: OrderQueryDto,
  ): Promise<any> {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.sellerId = :sellerId', { sellerId })
      .andWhere(
        '(order.orderNumber ILIKE :search OR customer.name ILIKE :search OR customer.email ILIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .skip(skip)
      .take(limit)
      .orderBy('order.createdAt', 'DESC');

    if (status && status !== 'all') {
      const statusMap: Record<string, OrderStatus> = {
        pending: OrderStatus.PENDING,
        processing: OrderStatus.PROCESSING,
        in_transit: OrderStatus.IN_TRANSIT,
        delivered: OrderStatus.DELIVERED,
        cancelled: OrderStatus.CANCELLED,
        returned: OrderStatus.RETURNED,
      };
      const orderStatus = statusMap[status.toLowerCase()];
      if (orderStatus) {
        queryBuilder.andWhere('order.status = :status', {
          status: orderStatus,
        });
      }
    }

    if (dateFrom && dateTo) {
      queryBuilder.andWhere('order.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom,
        dateTo,
      });
    } else if (dateFrom) {
      queryBuilder.andWhere('order.createdAt >= :dateFrom', { dateFrom });
    } else if (dateTo) {
      queryBuilder.andWhere('order.createdAt <= :dateTo', { dateTo });
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      orders: orders.map((order) => this.formatOrder(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get order statistics
  async getStatistics(
    sellerId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<any> {
    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.sellerId = :sellerId', { sellerId });

    if (dateFrom && dateTo) {
      queryBuilder.andWhere('order.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom,
        dateTo,
      });
    } else if (dateFrom) {
      queryBuilder.andWhere('order.createdAt >= :dateFrom', { dateFrom });
    } else if (dateTo) {
      queryBuilder.andWhere('order.createdAt <= :dateTo', { dateTo });
    }

    const orders = await queryBuilder.getMany();

    const stats = {
      total: orders.length,
      pending: orders.filter((o) => o.status === OrderStatus.PENDING).length,
      processing: orders.filter((o) => o.status === OrderStatus.PROCESSING)
        .length,
      inTransit: orders.filter((o) => o.status === OrderStatus.IN_TRANSIT)
        .length,
      delivered: orders.filter((o) => o.status === OrderStatus.DELIVERED)
        .length,
      cancelled: orders.filter((o) => o.status === OrderStatus.CANCELLED)
        .length,
      returned: orders.filter((o) => o.status === OrderStatus.RETURNED).length,
      totalRevenue: orders
        .filter(
          (o) =>
            o.status !== OrderStatus.CANCELLED &&
            o.status !== OrderStatus.RETURNED,
        )
        .reduce((sum, o) => sum + parseFloat(o.totalAmount.toString()), 0),
      averageOrderValue:
        orders.length > 0
          ? orders
              .filter(
                (o) =>
                  o.status !== OrderStatus.CANCELLED &&
                  o.status !== OrderStatus.RETURNED,
              )
              .reduce(
                (sum, o) => sum + parseFloat(o.totalAmount.toString()),
                0,
              ) /
            orders.filter(
              (o) =>
                o.status !== OrderStatus.CANCELLED &&
                o.status !== OrderStatus.RETURNED,
            ).length
          : 0,
    };

    return stats;
  }

  // Customer methods
  async findAllForCustomer(
    customerId: string,
    query: CustomerOrderQueryDto,
  ): Promise<{ orders: Order[]; pagination: any }> {
    const { page = 1, limit = 20, status, search, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.seller', 'seller')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.customerId = :customerId', { customerId })
      .skip(skip)
      .take(limit)
      .orderBy('order.createdAt', 'DESC');

    if (status && status !== 'all') {
      const statusMap: Record<string, OrderStatus> = {
        pending: OrderStatus.PENDING,
        processing: OrderStatus.PROCESSING,
        in_transit: OrderStatus.IN_TRANSIT,
        delivered: OrderStatus.DELIVERED,
        cancelled: OrderStatus.CANCELLED,
        returned: OrderStatus.RETURNED,
      };
      const orderStatus = statusMap[status.toLowerCase()];
      if (orderStatus) {
        queryBuilder.andWhere('order.status = :status', {
          status: orderStatus,
        });
      }
    }

    if (search) {
      queryBuilder.andWhere(
        '(order.orderNumber ILIKE :search OR seller.name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (dateFrom && dateTo) {
      queryBuilder.andWhere('order.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom,
        dateTo,
      });
    } else if (dateFrom) {
      queryBuilder.andWhere('order.createdAt >= :dateFrom', { dateFrom });
    } else if (dateTo) {
      queryBuilder.andWhere('order.createdAt <= :dateTo', { dateTo });
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      orders: orders.map((order) => this.formatOrderForCustomer(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneForCustomer(id: string, customerId: string): Promise<any> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['seller', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    // Get seller settings for additional seller information
    let sellerInfo: any = null;
    if (order.seller) {
      sellerInfo = {
        id: order.seller.id,
        name: order.seller.name,
        email: order.seller.email,
        phone: order.seller.phone || null,
      };

      try {
        const sellerSettings = await this.sellerSettingsService.getSettings(
          order.sellerId,
        );
        sellerInfo.storeName = sellerSettings.store?.name || null;
        sellerInfo.storeDescription = sellerSettings.store?.description || null;
        sellerInfo.storeLogo = sellerSettings.store?.logo || null;
        sellerInfo.phone = sellerSettings.account?.phone || sellerInfo.phone;
      } catch (error) {
        // Log but continue without additional seller info
        console.warn(
          `Failed to get seller settings for order ${order.orderNumber}:`,
          error,
        );
      }
    }

    const formattedOrder = this.formatOrderForCustomer(order);
    formattedOrder.seller = sellerInfo;
    return formattedOrder;
  }

  async findOnePublic(id: string): Promise<any> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['customer', 'seller', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.formatOrder(order);
  }

  private formatOrder(order: Order): any {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.customer
        ? {
            id: order.customer.id,
            name: order.customer.name,
            email: order.customer.email,
          }
        : null,
      seller: order.seller
        ? {
            id: order.seller.id,
            name: order.seller.name,
            email: order.seller.email,
          }
        : null,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
      })),
      totalAmount: parseFloat(order.totalAmount.toString()),
      status: order.status,
      trackingId: order.trackingId,
      statusExplanation:
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.RETURNED
          ? order.statusExplanation
          : null,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private formatOrderForCustomer(order: Order): any {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      seller: order.seller
        ? {
            id: order.seller.id,
            name: order.seller.name,
            email: order.seller.email,
          }
        : null,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
      })),
      totalAmount: parseFloat(order.totalAmount.toString()),
      status: order.status,
      trackingId: order.trackingId,
      statusExplanation:
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.RETURNED
          ? order.statusExplanation
          : null,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * Generate invoice PDF for customer order
   */
  async generateInvoice(
    orderId: string,
    customerId: string,
    format: string = 'pdf',
  ): Promise<{ orderNumber: string; pdfBuffer: Buffer }> {
    // Get order with all relations
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['seller', 'items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException(
        'You do not have permission to access this order',
      );
    }

    // Get seller settings for store name
    let sellerName = order.seller?.name || 'Seller';
    let storeName: string | null = null;

    try {
      const sellerSettings = await this.sellerSettingsService.getSettings(
        order.sellerId,
      );
      storeName = sellerSettings.store?.name || null;
    } catch (error) {
      // Log but continue without store name
      console.warn(
        `Failed to get seller settings for invoice ${order.orderNumber}:`,
        error,
      );
    }

    if (format === 'pdf') {
      // Generate PDF using pdfkit
      const PDFDocument = require('pdfkit');

      return new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({ margin: 50 });
          const buffers: Buffer[] = [];

          // Collect PDF data chunks
          doc.on('data', (chunk: Buffer) => buffers.push(chunk));
          doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            resolve({
              orderNumber: order.orderNumber,
              pdfBuffer,
            });
          });
          doc.on('error', (error: Error) => {
            reject(error);
          });

          // Header
          doc.fontSize(20).text('INVOICE', { align: 'center' });
          doc.moveDown();
          doc
            .fontSize(12)
            .text(`Order #${order.orderNumber}`, { align: 'center' });
          doc.text(`Date: ${order.createdAt.toLocaleDateString()}`, {
            align: 'center',
          });
          doc.moveDown();

          // Order Status
          doc.fontSize(10).text(`Status: ${order.status.toUpperCase()}`, {
            align: 'left',
          });
          doc.moveDown();

          // Seller Information (From:)
          doc.fontSize(12).text('From:', { underline: true });
          doc.fontSize(10).text(storeName || sellerName);
          if (order.seller?.email) {
            doc.text(order.seller.email);
          }
          doc.moveDown();

          // Shipping Address (Ship To:)
          doc.fontSize(12).text('Ship To:', { underline: true });
          doc.fontSize(10).text(order.shippingAddress.street);
          doc.text(
            `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zip}`,
          );
          doc.text(order.shippingAddress.country);
          if (order.shippingAddress.phone) {
            doc.text(`Phone: ${order.shippingAddress.phone}`);
          }
          doc.moveDown(2);

          // Order Items Table
          doc.fontSize(12).text('Items:', { underline: true });
          doc.moveDown(0.5);

          // Table header
          doc.fontSize(10);
          const tableY = doc.y;
          doc.text('Item', 50, tableY);
          doc.text('Quantity', 300, tableY);
          doc.text('Price', 400, tableY);
          doc.text('Total', 500, tableY);
          doc.moveDown(0.5);
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.5);

          // Table rows
          order.items.forEach((item) => {
            const itemTotal = parseFloat(item.price.toString()) * item.quantity;
            const rowY = doc.y;
            doc.text(item.productName, 50, rowY, { width: 240 });
            doc.text(item.quantity.toString(), 300, rowY);
            doc.text(
              `${parseFloat(item.price.toString()).toFixed(2)} MKD`,
              400,
              rowY,
            );
            doc.text(`${itemTotal.toFixed(2)} MKD`, 500, rowY);
            doc.moveDown(0.5);
          });

          doc.moveDown();
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown();

          // Total
          doc
            .fontSize(12)
            .text(
              `Total: ${parseFloat(order.totalAmount.toString()).toFixed(2)} MKD`,
              { align: 'right' },
            );

          // Tracking ID if available
          if (order.trackingId) {
            doc.moveDown();
            doc.fontSize(10).text(`Tracking ID: ${order.trackingId}`);
          }

          // Footer
          doc.moveDown(3);
          doc.fontSize(10).text('Thank you for your purchase!', {
            align: 'center',
          });
          doc.text('Generated by PazarOne Marketplace', { align: 'center' });

          // Finalize PDF
          doc.end();
        } catch (error) {
          reject(error);
        }
      });
    } else {
      throw new BadRequestException(`Unsupported format: ${format}`);
    }
  }
}
