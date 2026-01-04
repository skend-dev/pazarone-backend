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
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { EmailVerificationService } from './services/email-verification.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailVerificationService: EmailVerificationService,
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
        throw new BadRequestException(
          'Invalid or expired verification token',
        );
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

  async generateTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
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

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
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
}
