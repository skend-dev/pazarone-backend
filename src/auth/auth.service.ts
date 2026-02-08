import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User, UserType } from '../users/entities/user.entity';
import { IdentityProvider } from '../users/entities/user-identity.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { EmailVerificationService } from './services/email-verification.service';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

function normalizeFirebaseProvider(
  signInProvider: string | undefined,
): IdentityProvider {
  if (signInProvider === 'google.com') return 'google';
  if (signInProvider === 'apple.com') return 'apple';
  // Some tokens may omit firebase.sign_in_provider; default to google for backward compatibility
  if (
    signInProvider === undefined ||
    signInProvider === null ||
    signInProvider === ''
  ) {
    return 'google';
  }
  throw new BadRequestException(
    `Unsupported sign-in provider: ${signInProvider}. Only Google and Apple are supported.`,
  );
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailVerificationService: EmailVerificationService,
    private firebaseAdmin: FirebaseAdminService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Check if email is already verified
    const isVerified = await this.emailVerificationService.isEmailVerified(
      registerDto.email,
    );

    // If email is not verified, verification token is required
    if (!isVerified) {
      if (!registerDto.verificationToken) {
        throw new BadRequestException(
          'Email verification is required. Please verify your email before signing up.',
        );
      }

      // Validate verification token
      try {
        const { email } =
          await this.emailVerificationService.validateVerificationToken(
            registerDto.verificationToken,
          );

        // Ensure email matches
        if (email !== registerDto.email) {
          throw new BadRequestException(
            'Email does not match verification token',
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException('Invalid or expired verification token');
      }
    }
    // If email is already verified, no token is required

    // Create user account
    const user = await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      password: registerDto.password,
      userType: registerDto.userType,
      market: registerDto.market,
    });

    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.generateTokens(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async generateTokens(user: User, extraUserFields?: { providers?: string[] }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      userType: user.userType,
    };

    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtRefreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!jwtSecret || !jwtRefreshSecret) {
      throw new Error('JWT secrets are not configured');
    }

    const expiresIn = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '15m',
    ) as StringValue | number;
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    ) as StringValue | number;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtRefreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    const userResponse: {
      id: string;
      email: string | null;
      name: string;
      userType: string;
      createdAt: Date;
      updatedAt: Date;
      providers?: string[];
    } = {
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    if (extraUserFields?.providers) {
      userResponse.providers = extraUserFields.providers;
    }
    return {
      accessToken,
      refreshToken,
      user: userResponse,
    };
  }

  /**
   * Sign in or register via Firebase ID token (Google/Apple). Verifies token server-side,
   * then finds or creates user and links identity. Supports account linking by email.
   * For new users only, userType and market (when seller) can be sent from signup page.
   */
  async signInWithFirebase(
    idToken: string,
    _device?: { platform?: 'ios' | 'android' | 'web'; pushToken?: string },
    userType?: 'customer' | 'seller' | 'affiliate',
    market?: 'MK' | 'KS',
  ) {
    if (!this.firebaseAdmin.isConfigured()) {
      throw new BadRequestException(
        'Firebase sign-in is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.',
      );
    }

    // checkRevoked: false to avoid false failures (e.g. revocation check latency) on initial sign-in
    const decoded = await this.firebaseAdmin
      .verifyIdToken(idToken, false)
      .catch((err) => {
        throw new UnauthorizedException(
          err?.message ?? 'Invalid or expired Firebase ID token',
        );
      });

    if (!decoded.uid) {
      throw new UnauthorizedException('Invalid token: missing uid');
    }

    const provider = normalizeFirebaseProvider(decoded.sign_in_provider);
    const providerUid = decoded.uid;
    const email = decoded.email ?? null;
    const name = decoded.name ?? 'User';
    const picture = decoded.picture ?? null;

    let user: User | null = await this.usersService.findByIdentity(
      provider,
      providerUid,
    );

    if (user) {
      await this.usersService.updateOAuthProfile(user.id, {
        name: name || user.name,
        avatarUrl: picture ?? user.avatarUrl,
      });
      user = await this.usersService.findOne(user.id);
      const providers = await this.usersService.getProvidersForUser(user.id);
      return this.generateTokens(user!, { providers });
    }

    if (email) {
      const existingUser = await this.usersService.findByEmail(email);
      if (existingUser) {
        await this.usersService.addIdentity(
          existingUser.id,
          provider,
          providerUid,
          email,
        );
        await this.usersService.updateOAuthProfile(existingUser.id, {
          name: name || existingUser.name,
          avatarUrl: picture ?? existingUser.avatarUrl,
        });
        const linkedUser = await this.usersService.findOne(existingUser.id);
        const providers = await this.usersService.getProvidersForUser(
          linkedUser.id,
        );
        return this.generateTokens(linkedUser, { providers });
      }
    }

    const newUserType =
      userType === 'seller'
        ? UserType.SELLER
        : userType === 'affiliate'
          ? UserType.AFFILIATE
          : UserType.CUSTOMER;
    const newUser = await this.usersService.createOAuthUser({
      email,
      name,
      avatarUrl: picture,
      userType: newUserType,
      market: newUserType === UserType.SELLER ? (market ?? null) : null,
    });
    await this.usersService.addIdentity(
      newUser.id,
      provider,
      providerUid,
      email,
    );
    const providers = await this.usersService.getProvidersForUser(newUser.id);
    return this.generateTokens(newUser, { providers });
  }

  async refreshToken(refreshToken: string) {
    try {
      const jwtRefreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET');
      if (!jwtRefreshSecret) {
        throw new Error('JWT_REFRESH_SECRET is not configured');
      }

      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: jwtRefreshSecret,
      });

      const user = await this.usersService.findOne(payload.sub);
      return this.generateTokens(user);
    } catch (error) {
      throw new BadRequestException('Invalid refresh token');
    }
  }

  async registerCustomer(registerCustomerDto: RegisterCustomerDto) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(
      registerCustomerDto.email,
    );
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Check if email is already verified
    const isVerified = await this.emailVerificationService.isEmailVerified(
      registerCustomerDto.email,
    );

    if (!isVerified) {
      // If not verified, either verification token or code is required
      if (
        !registerCustomerDto.verificationToken &&
        !registerCustomerDto.verificationCode
      ) {
        throw new BadRequestException(
          'Verification token or code is required for unverified email',
        );
      }

      // If verification code is provided, verify it first to get the token
      if (registerCustomerDto.verificationCode) {
        try {
          const token = await this.emailVerificationService.verifyEmail(
            registerCustomerDto.email,
            registerCustomerDto.verificationCode,
          );
          // Use the token for validation
          registerCustomerDto.verificationToken = token;
        } catch (error) {
          throw new BadRequestException('Invalid or expired verification code');
        }
      }

      // Validate verification token
      if (registerCustomerDto.verificationToken) {
        const { email } =
          await this.emailVerificationService.validateVerificationToken(
            registerCustomerDto.verificationToken,
          );

        // Ensure email matches
        if (email !== registerCustomerDto.email) {
          throw new BadRequestException(
            'Email does not match verification token',
          );
        }
      }
    }
    // If email is already verified, no token is required

    // Create customer user
    const user = await this.usersService.create({
      email: registerCustomerDto.email,
      name: registerCustomerDto.name,
      password: registerCustomerDto.password,
      userType: UserType.CUSTOMER, // Customers registered during checkout
    });

    return this.generateTokens(user);
  }

  /**
   * Upgrade a customer to seller or affiliate. Returns new tokens and user so the client can refresh auth state.
   */
  async upgradeRole(
    user: User,
    userType: 'seller' | 'affiliate',
    market?: 'MK' | 'KS',
  ) {
    const type = userType === 'seller' ? UserType.SELLER : UserType.AFFILIATE;
    const updatedUser = await this.usersService.upgradeRole(
      user.id,
      type,
      market,
    );
    const providers = await this.usersService.getProvidersForUser(
      updatedUser.id,
    );
    return this.generateTokens(updatedUser, { providers });
  }

  /**
   * Set password for users who signed in with Google or Apple (no current password).
   * Not allowed for email/password-only accounts.
   */
  async setPassword(
    user: User,
    dto: SetPasswordDto,
  ): Promise<{ success: true; message: string }> {
    const providers = await this.usersService.getProvidersForUser(user.id);
    if (providers.length === 0) {
      throw new BadRequestException(
        'Set password is only for accounts that signed in with Google or Apple. Use change password instead.',
      );
    }
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }
    await this.usersService.updatePassword(user.id, dto.newPassword);
    await this.usersService.setHasPlatformPassword(user.id);
    return { success: true, message: 'Password set successfully' };
  }
}
