import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateImagesDto {
  @ApiProperty({
    description:
      'Product images (array of Cloudinary URLs). Minimum 1, maximum 8 images required.',
    type: [String],
    example: [
      'https://res.cloudinary.com/cloud-name/image/upload/v123/product1.jpg',
      'https://res.cloudinary.com/cloud-name/image/upload/v123/product2.jpg',
    ],
    minItems: 1,
    maxItems: 8,
  })
  @IsArray()
  @IsUrl({}, { each: true, message: 'Each image must be a valid URL' })
  @ArrayMinSize(1, { message: 'At least 1 image is required' })
  @ArrayMaxSize(8, { message: 'Maximum 8 images allowed' })
  images: string[];
}
