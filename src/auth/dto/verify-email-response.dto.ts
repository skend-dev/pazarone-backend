import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailResponseDto {
  @ApiProperty({
    description: 'Verification token to use for order creation or registration',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  verificationToken: string;

  @ApiProperty({
    description: 'Email address that was verified',
    example: 'user@example.com',
  })
  email: string;
}

