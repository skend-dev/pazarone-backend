import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { EmailVerificationService } from './services/email-verification.service';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { User, UserType } from '../users/entities/user.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let firebaseAdmin: jest.Mocked<Pick<FirebaseAdminService, 'isConfigured' | 'verifyIdToken'>>;

  const mockUser: User = {
    id: 'user-uuid',
    email: 'user@example.com',
    name: 'Test User',
    phone: null,
    avatarUrl: null,
    password: 'hashed',
    hasPlatformPassword: true,
    userType: UserType.CUSTOMER,
    market: null,
    referredByAffiliateId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByIdentity: jest.fn(),
      findByEmail: jest.fn(),
      findOne: jest.fn(),
      createOAuthUser: jest.fn(),
      addIdentity: jest.fn(),
      getProvidersForUser: jest.fn(),
      updateOAuthProfile: jest.fn(),
    };
    const mockFirebaseAdmin = {
      isConfigured: jest.fn().mockReturnValue(true),
      verifyIdToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: AffiliateService,
          useValue: {
            getAmbassadorByReferralCode: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                JWT_SECRET: 'test-secret-min-32-chars-long-enough',
                JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-chars-long',
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return map[key];
            }),
          },
        },
        {
          provide: EmailVerificationService,
          useValue: {},
        },
        {
          provide: FirebaseAdminService,
          useValue: mockFirebaseAdmin,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService) as jest.Mocked<UsersService>;
    firebaseAdmin = module.get(FirebaseAdminService) as jest.Mocked<
      Pick<FirebaseAdminService, 'isConfigured' | 'verifyIdToken'>
    >;
  });

  describe('signInWithFirebase', () => {
    it('should throw when Firebase is not configured', async () => {
      (firebaseAdmin.isConfigured as jest.Mock).mockReturnValue(false);
      await expect(
        authService.signInWithFirebase('fake-id-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when ID token is invalid', async () => {
      (firebaseAdmin.verifyIdToken as jest.Mock).mockRejectedValue(
        new Error('Invalid token'),
      );
      await expect(
        authService.signInWithFirebase('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens when user exists by identity (providerUid)', async () => {
      (firebaseAdmin.verifyIdToken as jest.Mock).mockResolvedValue({
        uid: 'firebase-uid-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: null,
        sign_in_provider: 'google.com',
      });
      usersService.findByIdentity.mockResolvedValue(mockUser);
      usersService.getProvidersForUser.mockResolvedValue(['google']);
      usersService.updateOAuthProfile.mockResolvedValue(undefined);
      usersService.findOne.mockResolvedValue(mockUser);

      const result = await authService.signInWithFirebase('valid-token');

      expect(result).toMatchObject({
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          providers: ['google'],
        },
      });
      expect(usersService.addIdentity).not.toHaveBeenCalled();
      expect(usersService.createOAuthUser).not.toHaveBeenCalled();
    });

    it('should link identity and return tokens when email matches existing user', async () => {
      (firebaseAdmin.verifyIdToken as jest.Mock).mockResolvedValue({
        uid: 'new-firebase-uid',
        email: 'existing@example.com',
        name: 'Existing User',
        picture: 'https://photo.url',
        sign_in_provider: 'apple.com',
      });
      usersService.findByIdentity.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue({ ...mockUser, email: 'existing@example.com' });
      usersService.addIdentity.mockResolvedValue({} as any);
      usersService.getProvidersForUser.mockResolvedValue(['apple']);
      usersService.updateOAuthProfile.mockResolvedValue(undefined);
      usersService.findOne.mockResolvedValue(mockUser);

      const result = await authService.signInWithFirebase('valid-token');

      expect(usersService.addIdentity).toHaveBeenCalledWith(
        mockUser.id,
        'apple',
        'new-firebase-uid',
        'existing@example.com',
      );
      expect(result.user.providers).toEqual(['apple']);
    });

    it('should create new user and identity when no match (with email)', async () => {
      const newUser = { ...mockUser, id: 'new-uuid', email: 'new@example.com' };
      (firebaseAdmin.verifyIdToken as jest.Mock).mockResolvedValue({
        uid: 'firebase-new',
        email: 'new@example.com',
        name: 'New User',
        picture: null,
        sign_in_provider: 'google.com',
      });
      usersService.findByIdentity.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createOAuthUser.mockResolvedValue(newUser);
      usersService.addIdentity.mockResolvedValue({} as any);
      usersService.getProvidersForUser.mockResolvedValue(['google']);

      const result = await authService.signInWithFirebase('valid-token');

      expect(usersService.createOAuthUser).toHaveBeenCalledWith({
        email: 'new@example.com',
        name: 'New User',
        avatarUrl: null,
        userType: UserType.CUSTOMER,
        market: null,
        referredByAffiliateId: null,
      });
      expect(usersService.addIdentity).toHaveBeenCalledWith(
        newUser.id,
        'google',
        'firebase-new',
        'new@example.com',
      );
      expect(result.user.id).toBe(newUser.id);
      expect(result.user.providers).toEqual(['google']);
    });

    it('should create user with null email when Apple hides email', async () => {
      const newUser = { ...mockUser, id: 'new-uuid', email: null };
      (firebaseAdmin.verifyIdToken as jest.Mock).mockResolvedValue({
        uid: 'apple-private-uid',
        email: null,
        name: 'Apple User',
        picture: null,
        sign_in_provider: 'apple.com',
      });
      usersService.findByIdentity.mockResolvedValue(null);
      usersService.createOAuthUser.mockResolvedValue(newUser);
      usersService.addIdentity.mockResolvedValue({} as any);
      usersService.getProvidersForUser.mockResolvedValue(['apple']);

      const result = await authService.signInWithFirebase('valid-token');

      expect(usersService.createOAuthUser).toHaveBeenCalledWith({
        email: null,
        name: 'Apple User',
        avatarUrl: null,
        userType: UserType.CUSTOMER,
        market: null,
        referredByAffiliateId: null,
      });
      expect(usersService.addIdentity).toHaveBeenCalledWith(
        newUser.id,
        'apple',
        'apple-private-uid',
        null,
      );
      expect(result.user.email).toBeNull();
    });
  });
});
