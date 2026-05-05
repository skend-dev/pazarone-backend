import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketingContactSyncService } from './marketing-contact-sync.service';
import { MarketingContact } from './entities/marketing-contact.entity';
import { User, UserType } from '../users/entities/user.entity';
import { CustomerNotificationPreferences } from '../customer/entities/customer-notification-preferences.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { MarketingInfobipContactPushService } from './marketing-infobip-contact-push.service';

function mockUser(partial: Partial<User> & { id: string; email: string | null }) {
  return {
    id: partial.id,
    email: partial.email,
    name: partial.name ?? 'Test',
    phone: partial.phone ?? null,
    avatarUrl: null,
    password: 'x',
    hasPlatformPassword: true,
    userType: partial.userType ?? UserType.CUSTOMER,
    market: partial.market ?? null,
    referredByAffiliateId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;
}

describe('MarketingContactSyncService', () => {
  let service: MarketingContactSyncService;
  let customerPrefsRepo: jest.Mocked<
    Pick<Repository<CustomerNotificationPreferences>, 'findOne'>
  >;
  let sellerSettingsRepo: jest.Mocked<
    Pick<Repository<SellerSettings>, 'findOne'>
  >;

  beforeEach(async () => {
    const marketingRepo = {
      findOne: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
    };

    const userRepo = {
      findOne: jest.fn(),
    };

    customerPrefsRepo = {
      findOne: jest.fn(),
    };

    sellerSettingsRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingContactSyncService,
        { provide: getRepositoryToken(MarketingContact), useValue: marketingRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: getRepositoryToken(CustomerNotificationPreferences),
          useValue: customerPrefsRepo,
        },
        {
          provide: getRepositoryToken(SellerSettings),
          useValue: sellerSettingsRepo,
        },
        {
          provide: MarketingInfobipContactPushService,
          useValue: { pushIfPhonePresent: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(MarketingContactSyncService);
  });

  describe('resolveEmailMarketingOptIn', () => {
    it('returns true for customer with no prefs row (matches PromotionEmailService)', async () => {
      customerPrefsRepo.findOne.mockResolvedValue(null);
      const u = mockUser({
        id: 'c1',
        email: 'c@example.com',
        userType: UserType.CUSTOMER,
      });
      await expect(service.resolveEmailMarketingOptIn(u)).resolves.toBe(true);
    });

    it('returns false when customer opted out', async () => {
      customerPrefsRepo.findOne.mockResolvedValue({
        customerId: 'c1',
        promotionalEmails: false,
      } as CustomerNotificationPreferences);
      const u = mockUser({
        id: 'c1',
        email: 'c@example.com',
        userType: UserType.CUSTOMER,
      });
      await expect(service.resolveEmailMarketingOptIn(u)).resolves.toBe(false);
    });

    it('returns false for seller without settings row', async () => {
      sellerSettingsRepo.findOne.mockResolvedValue(null);
      const u = mockUser({
        id: 's1',
        email: 's@example.com',
        userType: UserType.SELLER,
      });
      await expect(service.resolveEmailMarketingOptIn(u)).resolves.toBe(false);
    });

    it('returns true for seller when notificationsPromotions is true', async () => {
      sellerSettingsRepo.findOne.mockResolvedValue({
        notificationsPromotions: true,
      } as SellerSettings);
      const u = mockUser({
        id: 's1',
        email: 's@example.com',
        userType: UserType.SELLER,
      });
      await expect(service.resolveEmailMarketingOptIn(u)).resolves.toBe(true);
    });

    it('returns true for affiliates', async () => {
      const u = mockUser({
        id: 'a1',
        email: 'a@example.com',
        userType: UserType.AFFILIATE,
      });
      await expect(service.resolveEmailMarketingOptIn(u)).resolves.toBe(true);
    });

    it('returns false for admin', async () => {
      const u = mockUser({
        id: 'adm1',
        email: 'admin@example.com',
        userType: UserType.ADMIN,
      });
      await expect(service.resolveEmailMarketingOptIn(u)).resolves.toBe(false);
    });
  });
});
