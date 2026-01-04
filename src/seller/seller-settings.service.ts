import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SellerSettings } from './entities/seller-settings.entity';
import { User } from '../users/entities/user.entity';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdatePaymentsDto } from './dto/update-payments.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import { EmailService } from '../auth/services/email.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class SellerSettingsService {
  constructor(
    @InjectRepository(SellerSettings)
    private settingsRepository: Repository<SellerSettings>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private platformSettingsService: PlatformSettingsService,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
  ) {}

  async getSettings(sellerId: string) {
    let settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    if (!settings) {
      // Get default platform fee when creating new settings
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      settings = this.settingsRepository.create({
        sellerId,
        platformFeePercent: defaultPlatformFee,
      });
      settings = await this.settingsRepository.save(settings);
    }

    const user = await this.usersRepository.findOne({
      where: { id: sellerId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get platform fee (seller-specific or default)
    const platformFeePercent = await this.getPlatformFeePercent(sellerId);
    const isUsingDefaultFee = settings.platformFeePercent === null;

    return {
      account: {
        email: user.email,
        phone: settings.phone,
        market: user.market || 'MK', // Display current market (read-only)
      },
      store: {
        name: settings.storeName,
        description: settings.storeDescription,
        logo: settings.logo,
      },
      shipping: {
        countries: settings.shippingCountries || [],
      },
      payments: {
        bankAccount: settings.bankAccount
          ? this.maskBankAccount(settings.bankAccount)
          : null,
        bankName: settings.bankName || null,
        accountNumber: settings.accountNumber || null,
        accountHolder: settings.accountHolder || null,
        iban: settings.iban || null,
        swift: settings.swift || null,
        taxId: settings.taxId || null,
      },
      notifications: {
        orders: settings.notificationsOrders,
        reviews: settings.notificationsReviews,
        messages: settings.notificationsMessages,
        promotions: settings.notificationsPromotions,
        telegramChatId: settings.telegramChatId,
      },
      platformFee: {
        percent: platformFeePercent,
        isDefault: isUsingDefaultFee,
      },
      verified: settings.verified || false,
      paymentRestricted: settings.paymentRestricted || false,
      paymentRestrictedAt: settings.paymentRestrictedAt
        ? settings.paymentRestrictedAt.toISOString()
        : null,
    };
  }

  /**
   * Check if seller has payment restrictions
   */
  async hasPaymentRestriction(sellerId: string): Promise<boolean> {
    const settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });
    return settings?.paymentRestricted || false;
  }

  async updateAccount(sellerId: string, updateAccountDto: UpdateAccountDto) {
    const user = await this.usersRepository.findOne({
      where: { id: sellerId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateAccountDto.email && updateAccountDto.email !== user.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateAccountDto.email },
      });
      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
      user.email = updateAccountDto.email;
    }

    // Market cannot be changed after registration - it's set during signup only
    // This prevents accidental changes that could affect product pricing

    await this.usersRepository.save(user);

    let settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    if (!settings) {
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      settings = this.settingsRepository.create({
        sellerId,
        platformFeePercent: defaultPlatformFee,
      });
    }

    if (updateAccountDto.phone !== undefined) {
      settings.phone = updateAccountDto.phone;
    }

    await this.settingsRepository.save(settings);

    return {
      email: user.email,
      phone: settings.phone,
      market: user.market || 'MK', // Return current market (read-only)
    };
  }

  async updatePassword(sellerId: string, updatePasswordDto: UpdatePasswordDto) {
    if (updatePasswordDto.newPassword !== updatePasswordDto.confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    const user = await this.usersRepository.findOne({
      where: { id: sellerId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      updatePasswordDto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(updatePasswordDto.newPassword, 10);
    user.password = hashedPassword;
    await this.usersRepository.save(user);

    // Send password change confirmation email
    try {
      await this.emailService.sendPasswordChangeConfirmation(user.email);
    } catch (error) {
      // Log error but don't fail password change
      console.error(
        `Failed to send password change confirmation email to ${user.email}:`,
        error,
      );
    }

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  async updateStore(sellerId: string, updateStoreDto: UpdateStoreDto) {
    let settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    if (!settings) {
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      settings = this.settingsRepository.create({
        sellerId,
        platformFeePercent: defaultPlatformFee,
      });
    }

    if (updateStoreDto.name !== undefined) {
      settings.storeName = updateStoreDto.name;
    }
    if (updateStoreDto.description !== undefined) {
      settings.storeDescription = updateStoreDto.description;
    }
    if (updateStoreDto.logo !== undefined) {
      settings.logo = updateStoreDto.logo;
    }

    await this.settingsRepository.save(settings);

    return {
      name: settings.storeName,
      description: settings.storeDescription,
      logo: settings.logo,
    };
  }

  async updatePayments(sellerId: string, updatePaymentsDto: UpdatePaymentsDto) {
    let settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    if (!settings) {
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      settings = this.settingsRepository.create({
        sellerId,
        platformFeePercent: defaultPlatformFee,
      });
    }

    if (updatePaymentsDto.bankAccount !== undefined) {
      settings.bankAccount = updatePaymentsDto.bankAccount;
    }
    if (updatePaymentsDto.bankName !== undefined) {
      settings.bankName = updatePaymentsDto.bankName;
    }
    if (updatePaymentsDto.accountNumber !== undefined) {
      settings.accountNumber = updatePaymentsDto.accountNumber;
    }
    if (updatePaymentsDto.accountHolder !== undefined) {
      settings.accountHolder = updatePaymentsDto.accountHolder;
    }
    if (updatePaymentsDto.iban !== undefined) {
      settings.iban = updatePaymentsDto.iban;
    }
    if (updatePaymentsDto.swift !== undefined) {
      settings.swift = updatePaymentsDto.swift;
    }
    if (updatePaymentsDto.taxId !== undefined) {
      settings.taxId = updatePaymentsDto.taxId;
    }

    await this.settingsRepository.save(settings);

    return {
      bankAccount: settings.bankAccount
        ? this.maskBankAccount(settings.bankAccount)
        : null,
      bankName: settings.bankName || null,
      accountNumber: settings.accountNumber || null,
      accountHolder: settings.accountHolder || null,
      iban: settings.iban || null,
      swift: settings.swift || null,
      taxId: settings.taxId || null,
    };
  }

  async updateNotifications(
    sellerId: string,
    updateNotificationsDto: UpdateNotificationsDto,
  ) {
    let settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    if (!settings) {
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      settings = this.settingsRepository.create({
        sellerId,
        platformFeePercent: defaultPlatformFee,
      });
    }

    if (updateNotificationsDto.orders !== undefined) {
      settings.notificationsOrders = updateNotificationsDto.orders;
    }
    if (updateNotificationsDto.reviews !== undefined) {
      settings.notificationsReviews = updateNotificationsDto.reviews;
    }
    if (updateNotificationsDto.messages !== undefined) {
      settings.notificationsMessages = updateNotificationsDto.messages;
    }
    if (updateNotificationsDto.promotions !== undefined) {
      settings.notificationsPromotions = updateNotificationsDto.promotions;
    }
    if (updateNotificationsDto.telegramChatId !== undefined) {
      settings.telegramChatId = updateNotificationsDto.telegramChatId;
    }

    await this.settingsRepository.save(settings);

    return {
      orders: settings.notificationsOrders,
      reviews: settings.notificationsReviews,
      messages: settings.notificationsMessages,
      promotions: settings.notificationsPromotions,
      telegramChatId: settings.telegramChatId,
    };
  }

  async updateShipping(sellerId: string, updateShippingDto: UpdateShippingDto) {
    let settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    if (!settings) {
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      settings = this.settingsRepository.create({
        sellerId,
        platformFeePercent: defaultPlatformFee,
      });
    }

    if (updateShippingDto.shippingCountries !== undefined) {
      settings.shippingCountries = updateShippingDto.shippingCountries;
    }

    await this.settingsRepository.save(settings);

    return {
      countries: settings.shippingCountries || [],
    };
  }

  async verifyAccount(sellerId: string) {
    let settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    if (!settings) {
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      settings = this.settingsRepository.create({
        sellerId,
        platformFeePercent: defaultPlatformFee,
      });
    }

    // In a real implementation, this would trigger a verification process
    // For now, we'll just return success
    return {
      success: true,
      message: 'Verification request submitted',
    };
  }

  async getPerformance(sellerId: string) {
    // Mock performance metrics - would need actual review and order tracking
    return {
      averageRating: 4.8,
      responseRate: 99,
      onTimeDelivery: 98,
      totalReviews: 342,
    };
  }

  // Get platform fee for a seller (seller-specific or default)
  async getPlatformFeePercent(sellerId: string): Promise<number> {
    const settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    if (
      settings?.platformFeePercent !== null &&
      settings?.platformFeePercent !== undefined
    ) {
      return parseFloat(settings.platformFeePercent.toString());
    }

    // Return platform default
    return await this.platformSettingsService.getPlatformFeePercent();
  }

  // Update platform fee for a seller (admin only, used via admin service)
  async updatePlatformFeePercent(
    sellerId: string,
    platformFeePercent: number | null,
  ) {
    let settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    if (!settings) {
      const defaultPlatformFee =
        await this.platformSettingsService.getPlatformFeePercent();
      settings = this.settingsRepository.create({
        sellerId,
        platformFeePercent: platformFeePercent ?? defaultPlatformFee,
      });
    } else {
      settings.platformFeePercent = platformFeePercent;
    }

    await this.settingsRepository.save(settings);
    return {
      sellerId,
      platformFeePercent: settings.platformFeePercent
        ? parseFloat(settings.platformFeePercent.toString())
        : null,
      usingDefault: settings.platformFeePercent === null,
    };
  }

  // Get seller shipping countries (public method)
  async getSellerShippingCountries(sellerId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: sellerId },
    });

    if (!user) {
      return null;
    }

    const settings = await this.settingsRepository.findOne({
      where: { sellerId },
    });

    return settings;
  }

  private maskBankAccount(account: string): string {
    if (account.length <= 4) {
      return '****';
    }
    return `****${account.slice(-4)}`;
  }
}
