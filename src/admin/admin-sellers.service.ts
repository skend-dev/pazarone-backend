import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Product, ProductStatus } from '../products/entities/product.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { AdminQueryDto } from './dto/admin-query.dto';
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
}
