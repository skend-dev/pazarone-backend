import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User, UserType } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CustomerAddress } from './entities/customer-address.entity';
import { CustomerNotificationPreferences } from './entities/customer-notification-preferences.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { EmailService } from '../auth/services/email.service';
import { forwardRef, Inject } from '@nestjs/common';
import { MarketingContactSyncService } from '../marketing/marketing-contact-sync.service';
import { UserIdentity } from '../users/entities/user-identity.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PasswordReset } from '../auth/entities/password-reset.entity';
import { MarketingContact } from '../marketing/entities/marketing-contact.entity';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CustomerAddress)
    private addressesRepository: Repository<CustomerAddress>,
    @InjectRepository(CustomerNotificationPreferences)
    private notificationPreferencesRepository: Repository<CustomerNotificationPreferences>,
    @InjectRepository(UserIdentity)
    private userIdentityRepository: Repository<UserIdentity>,
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(MarketingContact)
    private marketingContactRepository: Repository<MarketingContact>,
    private usersService: UsersService,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
    private readonly marketingContactSyncService: MarketingContactSyncService,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Validate that user is a customer
   */
  private validateCustomer(user: User): void {
    if (user.userType !== UserType.CUSTOMER) {
      throw new ForbiddenException(
        'This endpoint is only available for customers',
      );
    }
  }

  /**
   * Update customer profile
   */
  async updateProfile(
    customerId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    if (updateProfileDto.name !== undefined) {
      user.name = updateProfileDto.name;
    }

    if (updateProfileDto.phone !== undefined) {
      user.phone = updateProfileDto.phone || null;
    }

    const saved = await this.usersRepository.save(user);
    await this.marketingContactSyncService.upsertFromUserId(saved.id);
    return saved;
  }

  /**
   * Change customer password
   */
  async changePassword(
    customerId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    // Validate confirmPassword matches newPassword
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('confirmPassword must match newPassword');
    }

    // Validate new password is different from current password
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Validate current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update password
    await this.usersService.updatePassword(user.id, newPassword);

    // Send password change confirmation email (only if user has email, e.g. not OAuth-only)
    if (user.email) {
      try {
        await this.emailService.sendPasswordChangeConfirmation(user.email);
      } catch (error) {
        console.error(
          `Failed to send password change confirmation email to ${user.email}:`,
          error,
        );
      }
    }
  }

  /**
   * Get all addresses for a customer
   */
  async getAddresses(customerId: string): Promise<CustomerAddress[]> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    return await this.addressesRepository.find({
      where: { customerId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Get default address for a customer
   */
  async getDefaultAddress(customerId: string): Promise<CustomerAddress | null> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    return await this.addressesRepository.findOne({
      where: { customerId, isDefault: true },
    });
  }

  /**
   * Get customer profile
   */
  async getProfile(customerId: string): Promise<User> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);
    return user;
  }

  /**
   * Create a new address
   */
  async createAddress(
    customerId: string,
    createAddressDto: CreateAddressDto,
  ): Promise<CustomerAddress> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    // If setting as default, unset other defaults
    if (createAddressDto.isDefault) {
      await this.addressesRepository.update(
        { customerId, isDefault: true },
        { isDefault: false },
      );
    }

    const address = this.addressesRepository.create({
      customerId,
      ...createAddressDto,
      isDefault: createAddressDto.isDefault || false,
    });

    return await this.addressesRepository.save(address);
  }

  /**
   * Update an address
   */
  async updateAddress(
    customerId: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<CustomerAddress> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    const address = await this.addressesRepository.findOne({
      where: { id: addressId, customerId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // If setting as default, unset other defaults
    if (updateAddressDto.isDefault === true) {
      await this.addressesRepository
        .createQueryBuilder()
        .update(CustomerAddress)
        .set({ isDefault: false })
        .where('customerId = :customerId', { customerId })
        .andWhere('id != :addressId', { addressId })
        .andWhere('isDefault = true')
        .execute();
    }

    Object.assign(address, updateAddressDto);
    return await this.addressesRepository.save(address);
  }

  /**
   * Delete an address
   */
  async deleteAddress(customerId: string, addressId: string): Promise<void> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    const address = await this.addressesRepository.findOne({
      where: { id: addressId, customerId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Check if this is the last address
    const addressCount = await this.addressesRepository.count({
      where: { customerId },
    });

    if (addressCount === 1) {
      throw new BadRequestException('Cannot delete the last address');
    }

    await this.addressesRepository.remove(address);
  }

  /**
   * Set default address
   */
  async setDefaultAddress(
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddress> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    const address = await this.addressesRepository.findOne({
      where: { id: addressId, customerId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Unset all other defaults
    await this.addressesRepository.update(
      { customerId, isDefault: true },
      { isDefault: false },
    );

    // Set this as default
    address.isDefault = true;
    return await this.addressesRepository.save(address);
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(
    customerId: string,
  ): Promise<CustomerNotificationPreferences> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    let preferences = await this.notificationPreferencesRepository.findOne({
      where: { customerId },
    });

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = this.notificationPreferencesRepository.create({
        customerId,
        orderUpdates: true,
        promotionalEmails: true,
        productRecommendations: false,
      });
      preferences =
        await this.notificationPreferencesRepository.save(preferences);
    }

    return preferences;
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    customerId: string,
    updateDto: UpdateNotificationPreferencesDto,
  ): Promise<CustomerNotificationPreferences> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    let preferences = await this.notificationPreferencesRepository.findOne({
      where: { customerId },
    });

    if (!preferences) {
      preferences = this.notificationPreferencesRepository.create({
        customerId,
        orderUpdates: updateDto.orderUpdates ?? true,
        promotionalEmails: updateDto.promotionalEmails ?? true,
        productRecommendations: updateDto.productRecommendations ?? false,
      });
    } else {
      if (updateDto.orderUpdates !== undefined) {
        preferences.orderUpdates = updateDto.orderUpdates;
      }
      if (updateDto.promotionalEmails !== undefined) {
        preferences.promotionalEmails = updateDto.promotionalEmails;
      }
      if (updateDto.productRecommendations !== undefined) {
        preferences.productRecommendations = updateDto.productRecommendations;
      }
    }

    const saved = await this.notificationPreferencesRepository.save(preferences);
    await this.marketingContactSyncService.upsertFromUserId(customerId);
    return saved;
  }

  /**
   * Permanently delete a customer account: remove personal data and anonymize the user
   * record so historical orders remain valid for legal and accounting purposes.
   */
  async deleteAccount(
    customerId: string,
    dto: DeleteAccountDto,
  ): Promise<{ success: true; message: string }> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    if (user.hasPlatformPassword) {
      const password = dto.currentPassword?.trim();
      if (!password) {
        throw new BadRequestException(
          'Current password is required to delete this account',
        );
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    const identities = await this.userIdentityRepository.find({
      where: { userId: customerId },
    });

    for (const identity of identities) {
      try {
        await this.firebaseAdmin.deleteAuthUser(identity.providerUid);
      } catch (err) {
        console.error(
          `Firebase delete failed for user ${customerId} provider ${identity.provider}:`,
          err,
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(CustomerAddress, { customerId });
      await queryRunner.manager.delete(CustomerNotificationPreferences, {
        customerId,
      });
      await queryRunner.manager.delete(Notification, { userId: customerId });
      await queryRunner.manager.delete(PasswordReset, { userId: customerId });
      await queryRunner.manager.delete(MarketingContact, { userId: customerId });
      await queryRunner.manager.delete(UserIdentity, { userId: customerId });

      const placeholderPassword = randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(placeholderPassword, 10);

      await queryRunner.manager.update(User, customerId, {
        email: `deleted.${customerId}@deleted.pazarone.internal`,
        name: 'Deleted User',
        phone: null,
        avatarUrl: null,
        password: hashedPassword,
        hasPlatformPassword: false,
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }
}
