import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserType } from '../users/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminQueryDto } from './dto/admin-query.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(query: AdminQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      queryBuilder.where(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(user);
    return {
      id: savedUser.id,
      email: savedUser.email,
      name: savedUser.name,
      userType: savedUser.userType,
      createdAt: savedUser.createdAt,
      updatedAt: savedUser.updatedAt,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('User with this email already exists');
      }
      user.email = updateUserDto.email;
    }

    if (updateUserDto.name) {
      user.name = updateUserDto.name;
    }

    if (updateUserDto.password) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    if (updateUserDto.userType) {
      // Prevent changing admin user type
      if (
        user.userType === UserType.ADMIN &&
        updateUserDto.userType !== UserType.ADMIN
      ) {
        throw new BadRequestException('Cannot change admin user type');
      }
      user.userType = updateUserDto.userType;
    }

    const updatedUser = await this.usersRepository.save(user);
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      userType: updatedUser.userType,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  async remove(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deleting admin users
    if (user.userType === UserType.ADMIN) {
      throw new BadRequestException('Cannot delete admin users');
    }

    await this.usersRepository.remove(user);
    return { message: 'User deleted successfully' };
  }

  async getStats() {
    const [total, sellers, affiliates, customers, admins] = await Promise.all([
      this.usersRepository.count(),
      this.usersRepository.count({ where: { userType: UserType.SELLER } }),
      this.usersRepository.count({ where: { userType: UserType.AFFILIATE } }),
      this.usersRepository.count({ where: { userType: UserType.CUSTOMER } }),
      this.usersRepository.count({ where: { userType: UserType.ADMIN } }),
    ]);

    return {
      total,
      sellers,
      affiliates,
      customers,
      admins,
    };
  }
}
