import { IsEmail, IsString, MinLength, IsEnum, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { UserType } from '../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsEnum(UserType)
  @IsNotEmpty()
  userType: UserType;

  @IsString()
  @IsOptional()
  @IsIn(['MK', 'KS'])
  market?: string;
}

