import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { AdminQueryDto } from './dto/admin-query.dto';

@Injectable()
export class AdminOrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  async findAll(
    query: AdminQueryDto & {
      status?: OrderStatus;
      dateFrom?: string;
      dateTo?: string;
      sellerId?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.seller', 'seller')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('order.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      queryBuilder.where(
        '(order.orderNumber ILIKE :search OR customer.name ILIKE :search OR customer.email ILIKE :search OR seller.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.status) {
      queryBuilder.andWhere('order.status = :status', { status: query.status });
    }

    if (query.sellerId) {
      queryBuilder.andWhere('order.sellerId = :sellerId', {
        sellerId: query.sellerId,
      });
    }

    if (query.dateFrom && query.dateTo) {
      queryBuilder.andWhere('order.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        sellerId: order.sellerId,
        sellerName: order.seller?.name || null,
        customerName: order.customer?.name || null,
        customerEmail: order.customer?.email || null,
        status: order.status,
        statusExplanation:
          order.status === OrderStatus.CANCELLED ||
          order.status === OrderStatus.RETURNED
            ? order.statusExplanation
            : null,
        totalAmount: parseFloat(order.totalAmount.toString()),
        shippingAddress: order.shippingAddress,
        trackingId: order.trackingId,
        referralCode: order.referralCode,
        items: order.items?.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          price: parseFloat(item.price.toString()),
        })) || [],
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['customer', 'seller', 'items', 'items.product'],
    });

    if (!order) {
      return null;
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      sellerId: order.sellerId,
      sellerName: order.seller?.name || null,
      customerName: order.customer?.name || null,
      customerEmail: order.customer?.email || null,
      customerPhone: order.shippingAddress?.phone || null,
      status: order.status,
      statusExplanation:
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.RETURNED
          ? order.statusExplanation
          : null,
      totalAmount: parseFloat(order.totalAmount.toString()),
      shippingAddress: order.shippingAddress,
      trackingId: order.trackingId,
      referralCode: order.referralCode,
      items: order.items?.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
      })) || [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async getStatistics(dateFrom?: string, dateTo?: string) {
    const queryBuilder = this.ordersRepository.createQueryBuilder('order');

    if (dateFrom && dateTo) {
      queryBuilder.where('order.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom,
        dateTo,
      });
    }

    const orders = await queryBuilder.getMany();

    // Get current month orders for monthly count
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyOrders = orders.filter(
      (o) => new Date(o.createdAt) >= startOfMonth,
    );

    // Get previous period for change percent calculation
    let previousPeriodOrders: Order[] = [];
    if (dateFrom && dateTo) {
      const periodStart = new Date(dateFrom);
      const periodEnd = new Date(dateTo);
      const periodDuration = periodEnd.getTime() - periodStart.getTime();
      const previousPeriodStart = new Date(
        periodStart.getTime() - periodDuration,
      );
      const previousPeriodEnd = periodStart;

      previousPeriodOrders = await this.ordersRepository
        .createQueryBuilder('order')
        .where('order.createdAt BETWEEN :dateFrom AND :dateTo', {
          dateFrom: previousPeriodStart.toISOString(),
          dateTo: previousPeriodEnd.toISOString(),
        })
        .getMany();
    } else {
      // If no date range, compare with previous month
      const startOfPreviousMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      previousPeriodOrders = await this.ordersRepository
        .createQueryBuilder('order')
        .where('order.createdAt BETWEEN :dateFrom AND :dateTo', {
          dateFrom: startOfPreviousMonth.toISOString(),
          dateTo: endOfPreviousMonth.toISOString(),
        })
        .getMany();
    }

    const currentTotal = orders.length;
    const previousTotal = previousPeriodOrders.length;
    const changePercent =
      previousTotal > 0
        ? ((currentTotal - previousTotal) / previousTotal) * 100
        : currentTotal > 0
          ? 100
          : 0;

    const stats = {
      total: orders.length,
      monthly: monthlyOrders.length,
      statusBreakdown: {
        pending: orders.filter((o) => o.status === OrderStatus.PENDING).length,
        processing: orders.filter(
          (o) => o.status === OrderStatus.PROCESSING,
        ).length,
        in_transit: orders.filter(
          (o) => o.status === OrderStatus.IN_TRANSIT,
        ).length,
        delivered: orders.filter((o) => o.status === OrderStatus.DELIVERED)
          .length,
        cancelled: orders.filter((o) => o.status === OrderStatus.CANCELLED)
          .length,
        returned: orders.filter((o) => o.status === OrderStatus.RETURNED)
          .length,
      },
      changePercent: Math.round(changePercent * 100) / 100, // Round to 2 decimal places
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
}

