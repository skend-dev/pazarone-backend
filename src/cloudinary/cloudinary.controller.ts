import {
  Controller,
  Post,
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
} from '@nestjs/swagger';
import { CloudinaryService } from './cloudinary.service';
import { MultipleUploadResponseDto } from './dto/upload-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { memoryStorage } from 'multer';

@ApiTags('upload')
@ApiBearerAuth('JWT-auth')
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('images')
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
    description: 'Images uploaded successfully',
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

    const results = await this.cloudinaryService.uploadMultipleImages(
      files,
      'products',
    );

    return {
      images: results.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      })),
    };
  }
}
