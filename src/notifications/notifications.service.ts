import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import {
  Notification,
  NotificationType,
  NotificationStatus,
} from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { User, UserType } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Rows visible in the inbox: own notifications, plus (for admins) pending product
   * approvals addressed to any admin so new admins still see the queue.
   */
  private recipientBracket(
    userId: string,
    userType?: UserType,
  ): Brackets {
    if (userType === UserType.ADMIN) {
      return new Brackets((qb) => {
        qb.where('notification.userId = :recipientUserId', {
          recipientUserId: userId,
        }).orWhere(
          '(notification.type = :_approvalType AND COALESCE((notification.metadata->>\'pendingApproval\')::boolean, false) = true)',
          { _approvalType: NotificationType.PRODUCT_APPROVED },
        );
      });
    }
    return new Brackets((qb) => {
      qb.where('notification.userId = :recipientUserId', {
        recipientUserId: userId,
      });
    });
  }

  private async countUnread(
    userId: string,
    userType?: UserType,
  ): Promise<number> {
    const qb = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.status = :status', {
        status: NotificationStatus.UNREAD,
      })
      .andWhere(this.recipientBracket(userId, userType));
    return qb.getCount();
  }

  /**
   * Create a new notification
   */
  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      ...createNotificationDto,
      status: NotificationStatus.UNREAD,
    });

    return await this.notificationsRepository.save(notification);
  }

  /**
   * Create multiple notifications at once
   */
  async createMany(
    notifications: CreateNotificationDto[],
  ): Promise<Notification[]> {
    const notificationEntities = notifications.map((dto) =>
      this.notificationsRepository.create({
        ...dto,
        status: NotificationStatus.UNREAD,
      }),
    );

    return await this.notificationsRepository.save(notificationEntities);
  }

  /**
   * Get all notifications for a user
   */
  async findAll(
    userId: string,
    query: NotificationQueryDto,
    userType?: UserType,
  ): Promise<{
    notifications: Notification[];
    pagination: any;
    unreadCount: number;
  }> {
    const { page = 1, limit = 20, status, type } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.notificationsRepository
      .createQueryBuilder('notification')
      .where(this.recipientBracket(userId, userType))
      .skip(skip)
      .take(limit)
      .orderBy('notification.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('notification.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    const [notifications, total] = await queryBuilder.getManyAndCount();

    const unreadCount = await this.countUnread(userId, userType);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  /**
   * Get a single notification
   */
  async findOne(
    id: string,
    userId: string,
    userType?: UserType,
  ): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Admins can access any notification, users can only access their own
    if (userType !== UserType.ADMIN && notification.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this notification',
      );
    }

    return notification;
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(
    notificationIds: string[],
    userId: string,
    userType?: UserType,
  ): Promise<{ count: number }> {
    // Verify all notifications belong to the user (unless admin)
    if (userType !== UserType.ADMIN) {
      const notifications = await this.notificationsRepository.find({
        where: { id: In(notificationIds) },
      });

      const unauthorized = notifications.some((n) => n.userId !== userId);

      if (unauthorized) {
        throw new ForbiddenException(
          'You do not have access to one or more notifications',
        );
      }
    }

    const result = await this.notificationsRepository.update(
      { id: In(notificationIds) },
      {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    );

    return { count: result.affected || 0 };
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(
    userId: string,
    userType?: UserType,
  ): Promise<{ count: number }> {
    const qb = this.notificationsRepository
      .createQueryBuilder('notification')
      .select('notification.id')
      .where('notification.status = :status', {
        status: NotificationStatus.UNREAD,
      })
      .andWhere(this.recipientBracket(userId, userType));

    const rows = await qb.getMany();
    if (rows.length === 0) {
      return { count: 0 };
    }
    const result = await this.notificationsRepository.update(
      { id: In(rows.map((r) => r.id)) },
      {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    );

    return { count: result.affected || 0 };
  }

  /**
   * Delete a notification
   */
  async remove(id: string, userId: string, userType?: UserType): Promise<void> {
    const notification = await this.findOne(id, userId, userType);
    await this.notificationsRepository.remove(notification);
  }

  /**
   * Delete multiple notifications
   */
  async removeMany(
    notificationIds: string[],
    userId: string,
    userType?: UserType,
  ): Promise<{ count: number }> {
    // Verify all notifications belong to the user (unless admin)
    if (userType !== UserType.ADMIN) {
      const notifications = await this.notificationsRepository.find({
        where: { id: In(notificationIds) },
      });

      const unauthorized = notifications.some((n) => n.userId !== userId);

      if (unauthorized) {
        throw new ForbiddenException(
          'You do not have access to one or more notifications',
        );
      }
    }

    const result = await this.notificationsRepository.delete({
      id: In(notificationIds),
    });

    return { count: result.affected || 0 };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'userType'],
    });
    return this.countUnread(userId, user?.userType);
  }

  /**
   * Helper method to create order-related notifications
   */
  async createOrderNotification(
    userId: string,
    type:
      | NotificationType.ORDER_CREATED
      | NotificationType.ORDER_UPDATED
      | NotificationType.ORDER_CANCELLED
      | NotificationType.ORDER_COMPLETED,
    orderId: string,
    orderNumber: string,
    additionalData?: Record<string, any>,
    isCustomer?: boolean,
  ): Promise<Notification> {
    // Different messages for sellers vs customers
    const sellerTitles = {
      [NotificationType.ORDER_CREATED]: 'New Order Received',
      [NotificationType.ORDER_UPDATED]: 'Order Updated',
      [NotificationType.ORDER_CANCELLED]: 'Order Cancelled',
      [NotificationType.ORDER_COMPLETED]: 'Order Completed',
    };

    const sellerMessages = {
      [NotificationType.ORDER_CREATED]: `You have received a new order #${orderNumber}`,
      [NotificationType.ORDER_UPDATED]: `Order #${orderNumber} has been updated`,
      [NotificationType.ORDER_CANCELLED]: `Order #${orderNumber} has been cancelled`,
      [NotificationType.ORDER_COMPLETED]: `Order #${orderNumber} has been completed`,
    };

    const customerTitles = {
      [NotificationType.ORDER_CREATED]: 'Order Confirmed',
      [NotificationType.ORDER_UPDATED]: 'Order Status Updated',
      [NotificationType.ORDER_CANCELLED]: 'Order Cancelled',
      [NotificationType.ORDER_COMPLETED]: 'Order Delivered',
    };

    const customerMessages = {
      [NotificationType.ORDER_CREATED]: `Your order #${orderNumber} has been confirmed`,
      [NotificationType.ORDER_UPDATED]: `Your order #${orderNumber} status has been updated${additionalData?.newStatus ? ` to ${additionalData.newStatus}` : ''}`,
      [NotificationType.ORDER_CANCELLED]: `Your order #${orderNumber} has been cancelled`,
      [NotificationType.ORDER_COMPLETED]: `Your order #${orderNumber} has been delivered`,
    };

    const titles = isCustomer ? customerTitles : sellerTitles;
    const messages = isCustomer ? customerMessages : sellerMessages;
    const link = isCustomer
      ? `/account/orders/${orderId}`
      : `/orders/${orderId}`;

    return await this.create({
      userId,
      type,
      title: titles[type],
      message: messages[type],
      metadata: {
        orderId,
        orderNumber,
        ...additionalData,
      },
      link,
    });
  }

  /**
   * Helper method to create product-related notifications
   */
  async createProductNotification(
    userId: string,
    type:
      | NotificationType.PRODUCT_APPROVED
      | NotificationType.PRODUCT_REJECTED
      | NotificationType.PRODUCT_LOW_STOCK,
    productId: string,
    productName: string,
    additionalData?: Record<string, any>,
    link?: string,
    customMessage?: string,
  ): Promise<Notification> {
    const titles = {
      [NotificationType.PRODUCT_APPROVED]: 'Product Approved',
      [NotificationType.PRODUCT_REJECTED]: 'Product Rejected',
      [NotificationType.PRODUCT_LOW_STOCK]: 'Low Stock Alert',
    };

    const messages = {
      [NotificationType.PRODUCT_APPROVED]: `Your product "${productName}" has been approved`,
      [NotificationType.PRODUCT_REJECTED]: customMessage
        ? `Your product "${productName}" has been rejected: ${customMessage}`
        : `Your product "${productName}" has been rejected`,
      [NotificationType.PRODUCT_LOW_STOCK]: `Your product "${productName}" is running low on stock`,
    };

    // Build metadata - ensure pendingApproval is not included for seller notifications
    const metadata: Record<string, any> = {
      productId,
      productName,
      ...additionalData,
    };
    // Explicitly remove pendingApproval if it exists (for seller notifications)
    if (
      type === NotificationType.PRODUCT_APPROVED &&
      !metadata.pendingApproval
    ) {
      // Ensure pendingApproval is not set for seller approval notifications
      delete metadata.pendingApproval;
    }

    return await this.create({
      userId,
      type,
      title: titles[type],
      message: messages[type],
      metadata,
      link: link || `/en/seller/products`,
    });
  }
}
