import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ description: 'Uploaded image URL', example: 'https://res.cloudinary.com/...' })
  url: string;

  @ApiProperty({ description: 'Cloudinary public ID', example: 'pazarone/products/abc123' })
  publicId: string;

  @ApiProperty({ description: 'Image width', example: 1000 })
  width: number;

  @ApiProperty({ description: 'Image height', example: 1000 })
  height: number;

  @ApiProperty({ description: 'File size in bytes', example: 245678 })
  bytes: number;
}

export class UploadErrorDto {
  @ApiProperty({ description: 'File name that failed to upload', example: 'image.jpg' })
  fileName: string;

  @ApiProperty({ description: 'Error message', example: 'File exceeds maximum size of 3MB' })
  error: string;
}

export class MultipleUploadResponseDto {
  @ApiProperty({ type: [UploadResponseDto], description: 'Array of successfully uploaded images' })
  images: UploadResponseDto[];

  @ApiProperty({ 
    type: [UploadErrorDto], 
    description: 'Array of failed uploads (if any)',
    required: false,
  })
  errors?: UploadErrorDto[];
}

