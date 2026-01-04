import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Product, ProductStatus } from '../products/entities/product.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { AffiliateCommission } from '../affiliate/entities/affiliate-commission.entity';
import { AdminQueryDto } from './dto/admin-query.dto';
import {
  SellerPaymentsQueryDto,
  PaymentMethod,
} from './dto/seller-payments-query.dto';
import { SellerPaymentOrdersQueryDto } from './dto/seller-payment-orders-query.dto';
import { MarkPaymentSettledDto } from './dto/mark-payment-settled.dto';
import { SellerSettingsService } from '../seller/seller-settings.service';
import { PlatformSettingsService } from '../platform/platform-settings.service';

@Injectable()
export class AdminSellersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(SellerSettings)
    private sellerSettingsRepository: Repository<SellerSettings>,
    @InjectRepository(AffiliateCommission)
    private affiliateCommissionRepository: Repository<AffiliateCommission>,
    private sellerSettingsService: SellerSettingsService,
    private platformSettingsService: PlatformSettingsService,
  ) {}

  async findAll(query: AdminQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .where('user.userType = :userType', { userType: UserType.SELLER })
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    // Get stats for each seller
    const sellersWithStats = await Promise.all(
      users.map(async (user) => {
        const settings = await this.sellerSettingsRepository.findOne({
          where: { sellerId: user.id },
        });

        const [totalOrders, totalRevenue, totalProducts] = await Promise.all([
          this.ordersRepository.count({ where: { sellerId: user.id } }),
          this.ordersRepository
            .createQueryBuilder('order')
            .select('SUM(order.totalAmount)', 'total')
            .where('order.sellerId = :sellerId', { sellerId: user.id })
            .andWhere('order.status = :status', {
              status: OrderStatus.DELIVERED,
            })
            .getRawOne(),
          this.productsRepository.count({ where: { sellerId: user.id } }),
        ]);

        // Get platform fee (seller-specific or default)
        const platformFeePercent =
          await this.sellerSettingsService.getPlatformFeePercent(user.id);
        const defaultPlatformFee =
          await this.platformSettingsService.getPlatformFeePercent();
        const isUsingDefault =
          settings?.platformFeePercent === null ||
          settings?.platformFeePercent === undefined;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          storeName: settings?.storeName || null,
          storeDescription: settings?.storeDescription || null,
          accountVerified: settings?.accountVerified || false,
          verified: settings?.verified || false,
          platformFeePercent,
          isUsingDefaultFee: isUsingDefault,
          defaultPlatformFee,
          totalOrders,
          totalRevenue: parseFloat(totalRevenue?.total || '0'),
          totalProducts,
          paymentRestricted: settings?.paymentRestricted || false,
          paymentRestrictedAt: settings?.paymentRestrictedAt || null,
          createdAt: user.createdAt,
        };
      }),
    );

    return {
      sellers: sellersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStatistics() {
    const [totalSellers, verifiedSellers, totalProducts, totalOrders] =
      await Promise.all([
        this.usersRepository.count({ where: { userType: UserType.SELLER } }),
        this.sellerSettingsRepository.count({
          where: { verified: true },
        }),
        this.productsRepository.count(),
        this.ordersRepository.count(),
      ]);

    const totalRevenue = await this.ordersRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.status = :status', { status: OrderStatus.DELIVERED })
      .getRawOne();

    return {
      totalSellers,
      verifiedSellers,
      totalProducts,
      totalOrders,
      totalRevenue: parseFloat(totalRevenue?.total || '0'),
    };
  }

  async updatePlatformFee(sellerId: string, platformFeePercent: number | null) {
    return await this.sellerSettingsService.updatePlatformFeePercent(
      sellerId,
      platformFeePercent,
    );
  }

  /**
   * Manually freeze a seller (apply payment restrictions)
   * This sets paymentRestricted flag and deactivates all products
   */
  async freezeSeller(sellerId: string): Promise<void> {
    const seller = await this.usersRepository.findOne({
      where: { id: sellerId, userType: UserType.SELLER },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    let sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    if (!sellerSettings) {
      // Create seller settings if they don't exist
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      sellerSettings = this.sellerSettingsRepository.create({
        sellerId,
        paymentRestricted: true,
        paymentRestrictedAt: new Date(),
        platformFeePercent: defaultPlatformFee,
      });
    } else {
      sellerSettings.paymentRestricted = true;
      sellerSettings.paymentRestrictedAt = new Date();
    }

    await this.sellerSettingsRepository.save(sellerSettings);

    // Deactivate all active products
    await this.productsRepository.update(
      { sellerId, status: ProductStatus.ACTIVE },
      { status: ProductStatus.INACTIVE },
    );
  }

  /**
   * Manually unfreeze a seller (remove payment restrictions)
   * This clears paymentRestricted flag and reactivates all inactive products
   * This is the opposite of freezeSeller - restores products to active state
   */
  async unfreezeSeller(sellerId: string): Promise<void> {
    const seller = await this.usersRepository.findOne({
      where: { id: sellerId, userType: UserType.SELLER },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    if (!sellerSettings) {
      throw new NotFoundException('Seller settings not found');
    }

    sellerSettings.paymentRestricted = false;
    sellerSettings.paymentRestrictedAt = null;
    await this.sellerSettingsRepository.save(sellerSettings);

    // Reactivate all inactive products (opposite of freeze)
    await this.productsRepository.update(
      { sellerId, status: ProductStatus.INACTIVE },
      { status: ProductStatus.ACTIVE },
    );
  }

  async verifySeller(sellerId: string) {
    let sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    if (!sellerSettings) {
      // Create seller settings if they don't exist
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      sellerSettings = this.sellerSettingsRepository.create({
        sellerId,
        verified: true,
        platformFeePercent: defaultPlatformFee,
      });
    } else {
      sellerSettings.verified = true;
    }

    // Auto-approve all pending products from this seller
    await this.productsRepository.update(
      {
        sellerId,
        approved: false,
      },
      {
        approved: true,
        status: ProductStatus.ACTIVE,
      },
    );

    return await this.sellerSettingsRepository.save(sellerSettings);
  }

  async unverifySeller(sellerId: string) {
    const sellerSettings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    if (!sellerSettings) {
      throw new NotFoundException('Seller settings not found');
    }

    sellerSettings.verified = false;
    // Note: We don't automatically reject existing approved products
    // Only new products will require approval

    return await this.sellerSettingsRepository.save(sellerSettings);
  }

  // Helper method to calculate platform fee and affiliate commission for an order
  private async calculateOrderFees(
    order: Order,
    sellerId: string,
  ): Promise<{
    platformFee: number;
    platformFeeMKD: number;
    platformFeeEUR: number;
    affiliateCommission: number;
    affiliateCommissionMKD: number;
    affiliateCommissionEUR: number;
  }> {
    const platformFeePercent =
      await this.sellerSettingsService.getPlatformFeePercent(sellerId);

    const orderTotalBase = order.totalAmountBase
      ? parseFloat(order.totalAmountBase.toString())
      : parseFloat(order.totalAmount.toString());
    const sellerCurrency = order.sellerBaseCurrency || 'MKD';

    // Calculate platform fee
    const platformFee = (orderTotalBase * platformFeePercent) / 100;

    // Get affiliate commissions for this order
    const affiliateCommissions = await this.affiliateCommissionRepository.find({
      where: { orderId: order.id },
    });

    // Aggregate affiliate commissions
    let affiliateCommissionMKD = 0;
    let affiliateCommissionEUR = 0;

    affiliateCommissions.forEach((commission) => {
      const commissionAmount = parseFloat(
        commission.commissionAmount.toString(),
      );
      // Affiliate commissions are stored in the seller's base currency
      if (sellerCurrency === 'MKD') {
        affiliateCommissionMKD += commissionAmount;
      } else if (sellerCurrency === 'EUR') {
        affiliateCommissionEUR += commissionAmount;
      }
    });

    const affiliateCommission = affiliateCommissionMKD + affiliateCommissionEUR;

    const platformFeeMKD = sellerCurrency === 'MKD' ? platformFee : 0;
    const platformFeeEUR = sellerCurrency === 'EUR' ? platformFee : 0;

    return {
      platformFee,
      platformFeeMKD,
      platformFeeEUR,
      affiliateCommission,
      affiliateCommissionMKD,
      affiliateCommissionEUR,
    };
  }

  // Get seller payment summaries
  async getSellerPaymentSummaries(query: SellerPaymentsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .where('user.userType = :userType', { userType: UserType.SELLER })
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    // Get payment summaries for each seller
    const summaries = await Promise.all(
      users.map(async (user) => {
        const settings = await this.sellerSettingsRepository.findOne({
          where: { sellerId: user.id },
        });

        // Build order query - only delivered orders
        const orderQueryBuilder = this.ordersRepository
          .createQueryBuilder('order')
          .where('order.sellerId = :sellerId', { sellerId: user.id })
          .andWhere('order.status = :status', {
            status: OrderStatus.DELIVERED,
          });

        if (query.paymentMethod) {
          orderQueryBuilder.andWhere('order.paymentMethod = :paymentMethod', {
            paymentMethod: query.paymentMethod,
          });
        }

        const orders = await orderQueryBuilder.getMany();

        // Calculate outstanding amounts
        let codOutstandingMKD = 0;
        let codOutstandingEUR = 0;
        let codOrderCount = 0;
        let cardOutstandingMKD = 0;
        let cardOutstandingEUR = 0;
        let cardOrderCount = 0;

        for (const order of orders) {
          // Only include orders that haven't been paid
          if (order.paymentMethod === 'cod' && !order.sellerPaid) {
            codOrderCount++;
            const fees = await this.calculateOrderFees(order, user.id);
            const sellerAmount = fees.platformFee + fees.affiliateCommission;
            codOutstandingMKD +=
              fees.platformFeeMKD + fees.affiliateCommissionMKD;
            codOutstandingEUR +=
              fees.platformFeeEUR + fees.affiliateCommissionEUR;
          } else if (order.paymentMethod === 'card' && !order.adminPaid) {
            cardOrderCount++;
            const orderTotalBase = order.totalAmountBase
              ? parseFloat(order.totalAmountBase.toString())
              : parseFloat(order.totalAmount.toString());
            const fees = await this.calculateOrderFees(order, user.id);
            const sellerAmount =
              orderTotalBase - fees.platformFee - fees.affiliateCommission;
            const sellerCurrency = order.sellerBaseCurrency || 'MKD';
            if (sellerCurrency === 'MKD') {
              cardOutstandingMKD += sellerAmount;
            } else if (sellerCurrency === 'EUR') {
              cardOutstandingEUR += sellerAmount;
            }
          }
        }

        // Calculate totals (legacy fields for backward compatibility)
        const codOutstanding = codOutstandingMKD + codOutstandingEUR;
        const cardOutstanding = cardOutstandingMKD + cardOutstandingEUR;
        const totalOutstanding = cardOutstanding - codOutstanding; // Positive = admin owes, negative = seller owes
        const totalOutstandingMKD = cardOutstandingMKD - codOutstandingMKD;
        const totalOutstandingEUR = cardOutstandingEUR - codOutstandingEUR;

        return {
          sellerId: user.id,
          sellerName: user.name,
          sellerEmail: user.email,
          storeName: settings?.storeName || null,
          codOutstanding,
          codOutstandingMKD,
          codOutstandingEUR,
          codOrderCount,
          cardOutstanding,
          cardOutstandingMKD,
          cardOutstandingEUR,
          cardOrderCount,
          totalOutstanding,
          totalOutstandingMKD,
          totalOutstandingEUR,
        };
      }),
    );

    // Return all sellers with their payment summaries
    // If paymentMethod filter is applied, orders are already filtered, so amounts will be zero for sellers without matching orders
    return {
      summaries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get seller payment orders
  async getSellerPaymentOrders(
    sellerId: string,
    query: SellerPaymentOrdersQueryDto,
  ) {
    // Verify seller exists
    const seller = await this.usersRepository.findOne({
      where: { id: sellerId, userType: UserType.SELLER },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const settings = await this.sellerSettingsRepository.findOne({
      where: { sellerId },
    });

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build order query
    const orderQueryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.sellerId = :sellerId', { sellerId })
      .andWhere('order.status = :status', { status: OrderStatus.DELIVERED })
      .orderBy('order.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.paymentMethod) {
      orderQueryBuilder.andWhere('order.paymentMethod = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }

    // Note: Always filter by DELIVERED status for payment tracking
    // The status filter in the query is ignored since only delivered orders are relevant for payment tracking

    const [orders, total] = await orderQueryBuilder.getManyAndCount();

    // Calculate order details with fees
    const orderDetails = await Promise.all(
      orders.map(async (order) => {
        const fees = await this.calculateOrderFees(order, sellerId);
        const orderTotalBase = order.totalAmountBase
          ? parseFloat(order.totalAmountBase.toString())
          : parseFloat(order.totalAmount.toString());
        const sellerCurrency = order.sellerBaseCurrency || 'MKD';

        // Calculate seller amount based on payment method
        let sellerAmount = 0;
        let sellerAmountMKD = 0;
        let sellerAmountEUR = 0;

        if (order.paymentMethod === 'cod') {
          // COD: seller owes admin (platform fee + affiliate commission)
          sellerAmount = fees.platformFee + fees.affiliateCommission;
          sellerAmountMKD = fees.platformFeeMKD + fees.affiliateCommissionMKD;
          sellerAmountEUR = fees.platformFeeEUR + fees.affiliateCommissionEUR;
        } else if (order.paymentMethod === 'card') {
          // Card: admin owes seller (total - platform fee - affiliate commission)
          sellerAmount =
            orderTotalBase - fees.platformFee - fees.affiliateCommission;
          if (sellerCurrency === 'MKD') {
            sellerAmountMKD = sellerAmount;
          } else if (sellerCurrency === 'EUR') {
            sellerAmountEUR = sellerAmount;
          }
        }

        // Find deliveredAt - we'll use updatedAt when status was changed to DELIVERED
        // For now, using createdAt as fallback
        const deliveredAt = order.updatedAt || order.createdAt;

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: parseFloat(order.totalAmount.toString()),
          totalAmountBase: orderTotalBase,
          buyerCurrency: order.buyerCurrency || 'MKD',
          sellerBaseCurrency: sellerCurrency,
          platformFee: fees.platformFee,
          platformFeeMKD: fees.platformFeeMKD,
          platformFeeEUR: fees.platformFeeEUR,
          affiliateCommission: fees.affiliateCommission,
          affiliateCommissionMKD: fees.affiliateCommissionMKD,
          affiliateCommissionEUR: fees.affiliateCommissionEUR,
          sellerAmount,
          sellerAmountMKD,
          sellerAmountEUR,
          paymentMethod: order.paymentMethod || 'cod',
          status: order.status,
          sellerPaid: order.sellerPaid,
          adminPaid: order.adminPaid,
          paymentSettledAt: order.paymentSettledAt,
          createdAt: order.createdAt,
          deliveredAt:
            order.status === OrderStatus.DELIVERED ? deliveredAt : undefined,
        };
      }),
    );

    // Calculate summary totals
    let codOutstandingMKD = 0;
    let codOutstandingEUR = 0;
    let cardOutstandingMKD = 0;
    let cardOutstandingEUR = 0;

    for (const order of orders) {
      const fees = await this.calculateOrderFees(order, sellerId);
      const orderTotalBase = order.totalAmountBase
        ? parseFloat(order.totalAmountBase.toString())
        : parseFloat(order.totalAmount.toString());
      const sellerCurrency = order.sellerBaseCurrency || 'MKD';

      if (order.paymentMethod === 'cod' && !order.sellerPaid) {
        const sellerAmount = fees.platformFee + fees.affiliateCommission;
        codOutstandingMKD += fees.platformFeeMKD + fees.affiliateCommissionMKD;
        codOutstandingEUR += fees.platformFeeEUR + fees.affiliateCommissionEUR;
      } else if (order.paymentMethod === 'card' && !order.adminPaid) {
        const sellerAmount =
          orderTotalBase - fees.platformFee - fees.affiliateCommission;
        if (sellerCurrency === 'MKD') {
          cardOutstandingMKD += sellerAmount;
        } else if (sellerCurrency === 'EUR') {
          cardOutstandingEUR += sellerAmount;
        }
      }
    }

    const codOutstanding = codOutstandingMKD + codOutstandingEUR;
    const cardOutstanding = cardOutstandingMKD + cardOutstandingEUR;
    const totalOutstanding = cardOutstanding - codOutstanding;
    const totalOutstandingMKD = cardOutstandingMKD - codOutstandingMKD;
    const totalOutstandingEUR = cardOutstandingEUR - codOutstandingEUR;

    return {
      orders: orderDetails,
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        storeName: settings?.storeName || null,
      },
      summary: {
        totalOutstanding,
        totalOutstandingMKD,
        totalOutstandingEUR,
        codOutstanding,
        codOutstandingMKD,
        codOutstandingEUR,
        cardOutstanding,
        cardOutstandingMKD,
        cardOutstandingEUR,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Mark COD payments as settled (seller has paid)
  async markCODPaymentsSettled(sellerId: string, dto: MarkPaymentSettledDto) {
    // Verify seller exists
    const seller = await this.usersRepository.findOne({
      where: { id: sellerId, userType: UserType.SELLER },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Get all orders with the provided IDs to validate
    const allOrders = await this.ordersRepository.find({
      where: {
        id: In(dto.orderIds),
        sellerId,
        status: OrderStatus.DELIVERED,
      },
    });

    if (allOrders.length === 0) {
      throw new NotFoundException(
        'No delivered orders found for the provided order IDs',
      );
    }

    // Check if all provided order IDs were found
    if (allOrders.length !== dto.orderIds.length) {
      const foundOrderIds = allOrders.map((o) => o.id);
      const missingOrderIds = dto.orderIds.filter(
        (id) => !foundOrderIds.includes(id),
      );
      throw new BadRequestException(
        `Some order IDs were not found or do not belong to this seller: ${missingOrderIds.join(', ')}`,
      );
    }

    // Validate all orders are COD
    const nonCodOrders = allOrders.filter((o) => o.paymentMethod !== 'cod');
    if (nonCodOrders.length > 0) {
      throw new BadRequestException(
        `Some orders are not COD orders: ${nonCodOrders.map((o) => o.orderNumber).join(', ')}`,
      );
    }

    // Validate orders are not already marked as paid
    const alreadyPaidOrders = allOrders.filter((o) => o.sellerPaid);
    if (alreadyPaidOrders.length > 0) {
      throw new BadRequestException(
        `Some COD orders have already been marked as paid: ${alreadyPaidOrders.map((o) => o.orderNumber).join(', ')}`,
      );
    }

    const orders = allOrders;

    // Update orders to mark as paid
    const now = new Date();
    const orderIds = orders.map((o) => o.id);
    await this.ordersRepository.update(
      { id: In(orderIds) },
      {
        sellerPaid: true,
        paymentSettledAt: now,
      },
    );

    // Get updated orders
    const updatedOrders = await this.ordersRepository.find({
      where: { id: In(orderIds) },
    });

    return {
      message: `Successfully marked ${updatedOrders.length} COD payment(s) as settled`,
      orders: updatedOrders.map((order) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        sellerPaid: order.sellerPaid,
        paymentSettledAt: order.paymentSettledAt
          ? order.paymentSettledAt.toISOString()
          : null,
      })),
      notes: dto.notes || null,
    };
  }

  // Mark Card payments as settled (admin has paid seller)
  async markCardPaymentsSettled(sellerId: string, dto: MarkPaymentSettledDto) {
    // Verify seller exists
    const seller = await this.usersRepository.findOne({
      where: { id: sellerId, userType: UserType.SELLER },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Get all orders with the provided IDs to validate
    const allOrders = await this.ordersRepository.find({
      where: {
        id: In(dto.orderIds),
        sellerId,
        status: OrderStatus.DELIVERED,
      },
    });

    if (allOrders.length === 0) {
      throw new NotFoundException(
        'No delivered orders found for the provided order IDs',
      );
    }

    // Check if all provided order IDs were found
    if (allOrders.length !== dto.orderIds.length) {
      const foundOrderIds = allOrders.map((o) => o.id);
      const missingOrderIds = dto.orderIds.filter(
        (id) => !foundOrderIds.includes(id),
      );
      throw new BadRequestException(
        `Some order IDs were not found or do not belong to this seller: ${missingOrderIds.join(', ')}`,
      );
    }

    // Validate all orders are Card
    const nonCardOrders = allOrders.filter((o) => o.paymentMethod !== 'card');
    if (nonCardOrders.length > 0) {
      throw new BadRequestException(
        `Some orders are not Card orders: ${nonCardOrders.map((o) => o.orderNumber).join(', ')}`,
      );
    }

    // Validate orders are not already marked as paid
    const alreadyPaidOrders = allOrders.filter((o) => o.adminPaid);
    if (alreadyPaidOrders.length > 0) {
      throw new BadRequestException(
        `Some Card orders have already been marked as paid: ${alreadyPaidOrders.map((o) => o.orderNumber).join(', ')}`,
      );
    }

    const orders = allOrders;

    // Update orders to mark as paid
    const now = new Date();
    const orderIds = orders.map((o) => o.id);
    await this.ordersRepository.update(
      { id: In(orderIds) },
      {
        adminPaid: true,
        paymentSettledAt: now,
      },
    );

    // Get updated orders
    const updatedOrders = await this.ordersRepository.find({
      where: { id: In(orderIds) },
    });

    return {
      message: `Successfully marked ${updatedOrders.length} Card payment(s) as settled`,
      orders: updatedOrders.map((order) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        adminPaid: order.adminPaid,
        paymentSettledAt: order.paymentSettledAt
          ? order.paymentSettledAt.toISOString()
          : null,
      })),
      notes: dto.notes || null,
    };
  }
}
