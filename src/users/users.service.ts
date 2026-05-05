import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User, UserType } from './entities/user.entity';
import {
  UserIdentity,
  IdentityProvider,
} from './entities/user-identity.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { MarketingContactSyncService } from '../marketing/marketing-contact-sync.service';

export interface CreateOAuthUserOptions {
  email: string | null;
  name: string;
  avatarUrl?: string | null;
  userType?: UserType;
  market?: 'MK' | 'KS' | null;
  referredByAffiliateId?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserIdentity)
    private identityRepository: Repository<UserIdentity>,
    private readonly marketingContactSyncService: MarketingContactSyncService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const { referredByAffiliateId, ...rest } = createUserDto;
    const user = this.usersRepository.create({
      ...rest,
      password: hashedPassword,
      hasPlatformPassword: true,
      referredByAffiliateId: referredByAffiliateId ?? null,
    });

    const saved = await this.usersRepository.save(user);
    await this.marketingContactSyncService.upsertFromUserId(saved.id);
    return saved;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Find user by OAuth identity (provider + provider UID). Returns null if no link.
   */
  async findByIdentity(
    provider: IdentityProvider,
    providerUid: string,
  ): Promise<User | null> {
    const identity = await this.identityRepository.findOne({
      where: { provider, providerUid },
      relations: ['user'],
    });
    return identity?.user ?? null;
  }

  /**
   * Get list of provider names for a user (e.g. ['google', 'apple']).
   */
  async getProvidersForUser(userId: string): Promise<string[]> {
    const identities = await this.identityRepository.find({
      where: { userId },
      select: ['provider'],
    });
    return identities.map((i) => i.provider);
  }

  /**
   * Link an OAuth identity to an existing user (account linking by email).
   */
  async addIdentity(
    userId: string,
    provider: IdentityProvider,
    providerUid: string,
    email: string | null,
  ): Promise<UserIdentity> {
    const identity = this.identityRepository.create({
      userId,
      provider,
      providerUid,
      email,
    });
    return this.identityRepository.save(identity);
  }

  /**
   * Create a user for OAuth sign-in (no password login). Uses a random placeholder password.
   */
  async createOAuthUser(options: CreateOAuthUserOptions): Promise<User> {
    const {
      email,
      name,
      avatarUrl = null,
      userType = UserType.CUSTOMER,
      market = null,
      referredByAffiliateId = null,
    } = options;
    if (userType === UserType.SELLER && !market) {
      throw new BadRequestException(
        'Market (MK or KS) is required when creating a seller.',
      );
    }
    if (email != null) {
      const existing = await this.findByEmail(email);
      if (existing) {
        throw new ConflictException('User with this email already exists');
      }
    }
    const placeholderPassword = randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(placeholderPassword, 10);
    const user = this.usersRepository.create({
      email: email ?? null,
      name,
      password: hashedPassword,
      userType,
      avatarUrl,
      market: userType === UserType.SELLER ? market : null,
      hasPlatformPassword: false,
      referredByAffiliateId: referredByAffiliateId ?? null,
    });
    const saved = await this.usersRepository.save(user);
    await this.marketingContactSyncService.upsertFromUserId(saved.id);
    return saved;
  }

  /**
   * Update user profile (name, avatar) for OAuth. Useful when linking or first sign-in.
   */
  async updateOAuthProfile(
    userId: string,
    updates: { name?: string; avatarUrl?: string | null },
  ): Promise<void> {
    await this.usersRepository.update(userId, updates);
    await this.marketingContactSyncService.upsertFromUserId(userId);
  }

  /**
   * Validate user password
   */
  async validatePassword(email: string, password: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    if (!user) {
      return false;
    }
    return await bcrypt.compare(password, user.password);
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.findOne(userId);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await this.usersRepository.save(user);
  }

  /**
   * Mark that the user has set a platform password (e.g. after set-password flow for OAuth users).
   */
  async setHasPlatformPassword(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { hasPlatformPassword: true });
  }

  /**
   * Upgrade a customer to seller or affiliate. Only customers can upgrade.
   */
  async upgradeRole(
    userId: string,
    userType: UserType.SELLER | UserType.AFFILIATE,
    market?: 'MK' | 'KS',
    referredByAffiliateId?: string | null,
  ): Promise<User> {
    const user = await this.findOne(userId);
    if (user.userType !== UserType.CUSTOMER) {
      throw new ForbiddenException(
        'Only customers can upgrade to seller or affiliate. You are already a ' +
          user.userType +
          '.',
      );
    }
    if (userType === UserType.SELLER && !market) {
      throw new BadRequestException(
        'Market (MK or KS) is required when becoming a seller.',
      );
    }
    user.userType = userType;
    user.market = userType === UserType.SELLER ? (market ?? null) : null;
    if (userType === UserType.SELLER && referredByAffiliateId != null) {
      user.referredByAffiliateId = referredByAffiliateId;
    }
    const saved = await this.usersRepository.save(user);
    await this.marketingContactSyncService.upsertFromUserId(saved.id);
    return saved;
  }
}
