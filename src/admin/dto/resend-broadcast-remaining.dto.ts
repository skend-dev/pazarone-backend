import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ResendBroadcastRemainingDto {
  @ApiPropertyOptional({
    description:
      'Max number of remaining recipients to send to. Omit to send to all who have not received this campaign yet.',
    minimum: 1,
    maximum: 100_000,
    example: 300,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  recipientLimit?: number;
}
