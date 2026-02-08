import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsObject,
  ValidateNested,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DeviceDto {
  @ApiPropertyOptional({
    enum: ['ios', 'android', 'web'],
    description: 'Client platform',
  })
  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';

  @ApiPropertyOptional({ description: 'Push notification token' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  pushToken?: string;
}

export class FirebaseAuthDto {
  @ApiProperty({
    description: 'Firebase ID token from client sign-in (Google/Apple)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'idToken is required' })
  idToken: string;

  @ApiPropertyOptional({
    description: 'Device info for push tokens etc.',
    type: DeviceDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DeviceDto)
  device?: {
    platform?: 'ios' | 'android' | 'web';
    pushToken?: string;
  };

  @ApiPropertyOptional({
    description: 'For new users only: desired role (e.g. from signup page). Ignored for existing users.',
    enum: ['customer', 'seller', 'affiliate'],
  })
  @IsOptional()
  @IsIn(['customer', 'seller', 'affiliate'])
  userType?: 'customer' | 'seller' | 'affiliate';

  @ApiPropertyOptional({
    description: 'Required when userType is seller. Market: MK or KS.',
    enum: ['MK', 'KS'],
  })
  @ValidateIf((o) => o.userType === 'seller')
  @IsOptional()
  @IsString()
  @IsIn(['MK', 'KS'])
  market?: 'MK' | 'KS';
}
