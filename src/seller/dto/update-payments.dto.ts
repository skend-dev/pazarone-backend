import { IsString, IsOptional } from 'class-validator';

export class UpdatePaymentsDto {
  @IsString()
  @IsOptional()
  bankAccount?: string;

  @IsString()
  @IsOptional()
  taxId?: string;
}

