import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteImageDto {
  @ApiProperty({
    description: 'Cloudinary public ID of the image to delete',
    example: 'pazarone/products/image123',
  })
  @IsString()
  @IsNotEmpty({ message: 'publicId is required' })
  publicId: string;
}
