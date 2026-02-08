import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpgradeRoleDto {
  @ApiProperty({
    description: 'Role to upgrade to (customer can become seller or affiliate)',
    enum: ['seller', 'affiliate'],
  })
  @IsIn(['seller', 'affiliate'], {
    message: 'userType must be seller or affiliate',
  })
  userType: 'seller' | 'affiliate';

  @ValidateIf((o) => o.userType === 'seller')
  @IsString()
  @IsIn(['MK', 'KS'], { message: 'market must be MK or KS when becoming a seller' })
  @ApiPropertyOptional({
    description: 'Market for sellers (MK = North Macedonia, KS = Kosovo). Required when userType is seller.',
    enum: ['MK', 'KS'],
  })
  market?: 'MK' | 'KS';
}
