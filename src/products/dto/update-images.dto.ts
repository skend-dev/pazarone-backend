import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateImagesDto {
  @ApiProperty({
    description:
      'Product images (array of Cloudinary URLs). Minimum 1, maximum 8 images required.',
    type: [String],
    example: [
      'https://res.cloudinary.com/.../image1.jpg',
      'https://res.cloudinary.com/.../image2.jpg',
    ],
    minItems: 1,
    maxItems: 8,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least 1 image is required' })
  @ArrayMaxSize(8, { message: 'Maximum 8 images allowed' })
  images: string[];
}
