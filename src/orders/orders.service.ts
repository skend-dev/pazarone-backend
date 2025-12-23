import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
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
import { CustomerService } from '../customer/customer.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
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
    @Inject(forwardRef(() => CustomerService))
    private customerService: CustomerService,
  ) {}

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

    // Send web notification to seller for status changes
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

      // Notify seller
      const sellerNotification =
        await this.notificationsService.createOrderNotification(
          sellerId,
          notificationType,
          updatedOrder.id,
          updatedOrder.orderNumber,
          notificationMetadata,
          false, // isCustomer = false
        );
      await this.notificationsGateway.sendNotificationToUser(
        sellerId,
        sellerNotification,
      );

      // Notify customer
      if (updatedOrder.customerId) {
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

    return this.formatOrder(updatedOrder);
  }

  // Generate unique order number
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  // Create new order (supports guest orders)
  async create(
    customerId: string | null,
    createOrderDto: CreateOrderDto,
  ): Promise<any> {
    const {
      sellerId,
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

    // Validate products and calculate total
    let totalAmount = 0;
    const orderItems: OrderItem[] = [];

    for (const itemDto of items) {
      const product = await this.productsRepository.findOne({
        where: { id: itemDto.productId },
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

      if (product.stock < itemDto.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${itemDto.quantity}`,
        );
      }

      const itemTotal = parseFloat(product.price.toString()) * itemDto.quantity;
      totalAmount += itemTotal;

      const orderItem = this.orderItemsRepository.create({
        productId: product.id,
        productName: product.name,
        quantity: itemDto.quantity,
        price: parseFloat(product.price.toString()),
      });

      orderItems.push(orderItem);

      // Update product stock
      product.stock -= itemDto.quantity;
      if (product.stock === 0) {
        product.status = 'out_of_stock' as any;
      }
      await this.productsRepository.save(product);
    }

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
    const order = this.ordersRepository.create({
      orderNumber: this.generateOrderNumber(),
      sellerId,
      customerId: finalCustomerId,
      affiliateId: finalAffiliateId,
      referralCode: finalReferralCode,
      totalAmount,
      status: OrderStatus.PENDING,
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

      // Notify seller
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

      // Notify customer
      if (finalCustomerId) {
        const customerNotification =
          await this.notificationsService.createOrderNotification(
            finalCustomerId,
            NotificationType.ORDER_CREATED,
            savedOrder.id,
            savedOrder.orderNumber,
            notificationMetadata,
            true, // isCustomer = true
          );
        await this.notificationsGateway.sendNotificationToUser(
          finalCustomerId,
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

    // Save shipping address for authenticated customers (not guests)
    // Only save if customer is authenticated (providedCustomerId or customerId was set)
    if (providedCustomerId || customerId) {
      try {
        const customerIdToUse = providedCustomerId || customerId;
        if (customerIdToUse) {
          // Check if customer already has a default address
          const existingDefaultAddress =
            await this.customerService.getDefaultAddress(customerIdToUse);

          // If no default address exists, save the shipping address as default
          if (!existingDefaultAddress) {
            await this.customerService.createAddress(customerIdToUse, {
              street: shippingAddress.street,
              city: shippingAddress.city,
              state: shippingAddress.state,
              zip: shippingAddress.zip,
              country: shippingAddress.country,
              phone: shippingAddress.phone || customer.phone || '',
              isDefault: true,
            });
          }
        }
      } catch (error) {
        // Log error but don't fail order creation
        console.error(
          `[Order ${savedOrder.orderNumber}] Failed to save shipping address:`,
          error,
        );
      }
    }

    // Reload with relations
    return this.findOnePublic(savedOrder.id);
  }

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

    return this.formatOrderForCustomer(order);
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
}
