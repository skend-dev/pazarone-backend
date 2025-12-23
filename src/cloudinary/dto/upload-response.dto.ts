import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ description: 'Uploaded image URL', example: 'https://res.cloudinary.com/...' })
  url: string;

  @ApiProperty({ description: 'Cloudinary public ID', example: 'pazaro/products/abc123' })
  publicId: string;

  @ApiProperty({ description: 'Image width', example: 1000 })
  width: number;

  @ApiProperty({ description: 'Image height', example: 1000 })
  height: number;

  @ApiProperty({ description: 'File size in bytes', example: 245678 })
  bytes: number;
}

export class MultipleUploadResponseDto {
  @ApiProperty({ type: [UploadResponseDto], description: 'Array of uploaded images' })
  images: UploadResponseDto[];
}

