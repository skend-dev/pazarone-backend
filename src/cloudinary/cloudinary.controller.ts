import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CloudinaryService } from './cloudinary.service';
import { MultipleUploadResponseDto } from './dto/upload-response.dto';
import { DeleteImageDto } from './dto/delete-image.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { memoryStorage } from 'multer';

@ApiTags('cloudinary')
@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(
    FilesInterceptor('images', 8, {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException(
              'Only image files (jpeg, jpg, png, gif, webp) are allowed!',
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 3 * 1024 * 1024, // 3MB limit per image
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload product images to Cloudinary',
    description:
      'Upload up to 8 product images. Maximum 3MB per image. Images are automatically compressed to ~500KB and converted to WebP format for optimal performance.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          maxItems: 8,
          description: 'Up to 8 images, max 3MB each',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Images uploaded successfully (may include partial failures)',
    type: MultipleUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - invalid file type, size (max 3MB), or too many files (max 8)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<MultipleUploadResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    if (files.length > 8) {
      throw new BadRequestException('Maximum 8 images allowed per upload');
    }

    const { successful, failed } = await this.cloudinaryService.uploadMultipleImages(
      files,
      'products',
    );

    // If all uploads failed, throw an error
    if (successful.length === 0 && failed.length > 0) {
      const errorMessages = failed.map((f) => f.error).join('; ');
      throw new BadRequestException(
        `All image uploads failed: ${errorMessages}`,
      );
    }

    // If some uploads failed, include them in the response
    const response: MultipleUploadResponseDto = {
      images: successful.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      })),
    };

    // Include errors if any uploads failed
    if (failed.length > 0) {
      (response as any).errors = failed.map((f) => ({
        fileName: f.file.originalname,
        error: f.error,
      }));
    }

    return response;
  }

  @Get('sign')
  // @UseGuards(JwtAuthGuard) // Optional: uncomment to require authentication (recommended)
  // @ApiBearerAuth('JWT-auth') // Optional: uncomment if using auth guard
  @ApiOperation({
    summary: 'Get signed upload parameters for direct Cloudinary uploads',
    description:
      'Returns signature and parameters needed for client-side signed uploads to Cloudinary. The frontend can use these to upload directly to Cloudinary without proxying through the backend. Authentication is optional but recommended for security.',
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    description:
      'Cloudinary folder path (defaults to CLOUDINARY_FOLDER env var or "products")',
    example: 'products',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload signature generated successfully',
    schema: {
      type: 'object',
      properties: {
        api_key: {
          type: 'string',
          description: 'Cloudinary API key',
          example: '123456789012345',
        },
        timestamp: {
          type: 'number',
          description: 'Unix timestamp in seconds',
          example: 1704067200,
        },
        signature: {
          type: 'string',
          description: 'HMAC-SHA1 signature for the upload',
          example: 'a1b2c3d4e5f6...',
        },
        folder: {
          type: 'string',
          description: 'Target folder for uploads',
          example: 'products',
        },
        cloud_name: {
          type: 'string',
          description: 'Cloudinary cloud name',
          example: 'my-cloud',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Cloudinary configuration error',
  })
  getUploadSignature(@Query('folder') folder?: string) {
    try {
      const result = this.cloudinaryService.generateUploadSignature(folder);
      return result;
    } catch (error) {
      // Enhanced error message for debugging
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate upload signature';
      
      throw new BadRequestException(
        errorMessage +
          '. Please verify CLOUDINARY_API_SECRET, CLOUDINARY_API_KEY, and CLOUDINARY_CLOUD_NAME environment variables.',
      );
    }
  }

  @Post('delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete an image from Cloudinary',
    description:
      'Deletes an image from Cloudinary by public ID. Only allows deletion of images within the "pazarone/" prefix for security.',
  })
  @ApiBody({ type: DeleteImageDto })
  @ApiResponse({
    status: 200,
    description: 'Image deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Image deleted successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid public ID or public ID outside allowed prefix',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteImage(@Body() deleteImageDto: DeleteImageDto) {
    const { publicId } = deleteImageDto;

    // Security: Only allow deletion of images within "pazarone/" prefix
    if (!publicId.startsWith('pazarone/')) {
      throw new BadRequestException(
        'Only images within the "pazarone/" prefix can be deleted',
      );
    }

    try {
      await this.cloudinaryService.deleteImage(publicId);
      return {
        success: true,
        message: 'Image deleted successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to delete image',
      );
    }
  }
}
