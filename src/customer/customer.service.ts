import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserType } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CustomerAddress } from './entities/customer-address.entity';
import { CustomerNotificationPreferences } from './entities/customer-notification-preferences.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CustomerAddress)
    private addressesRepository: Repository<CustomerAddress>,
    @InjectRepository(CustomerNotificationPreferences)
    private notificationPreferencesRepository: Repository<CustomerNotificationPreferences>,
    private usersService: UsersService,
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

    return await this.usersRepository.save(user);
  }

  /**
   * Change customer password
   */
  async changePassword(
    customerId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findOne(customerId);
    this.validateCustomer(user);

    // Validate current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Update password
    await this.usersService.updatePassword(user.id, newPassword);
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

    return await this.notificationPreferencesRepository.save(preferences);
  }
}
