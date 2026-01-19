import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'products',
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `pazarone/${folder}`,
          resource_type: 'image',
          transformation: [
            // Limit dimensions to 1000x1000px max (maintains aspect ratio)
            { width: 1000, height: 1000, crop: 'limit' },
            // Auto quality with good compression balance (targets ~500KB)
            // Cloudinary's auto:good intelligently balances quality vs file size
            { quality: 'auto:good' },
            // Force WebP format for optimal compression and performance
            // WebP provides 25-35% better compression than JPEG/PNG
            { fetch_format: 'webp' },
            // Progressive loading for better perceived performance
            { flags: 'progressive' },
          ],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result);
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: string = 'products',
  ): Promise<(UploadApiResponse | UploadApiErrorResponse)[]> {
    const uploadPromises = files.map((file) => this.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  async deleteMultipleImages(publicIds: string[]): Promise<void> {
    if (!publicIds || publicIds.length === 0) {
      console.warn('No public IDs provided for deletion');
      return;
    }

    try {
      console.log(`Attempting to delete ${publicIds.length} images from Cloudinary:`, publicIds);
      const result = await cloudinary.api.delete_resources(publicIds, {
        resource_type: 'image',
        invalidate: true, // Invalidate CDN cache to ensure images are removed
      });
      
      console.log('Cloudinary deletion result:', JSON.stringify(result, null, 2));
      
      // Check if deletion was successful
      if (result.deleted && Object.keys(result.deleted).length > 0) {
        console.log(`Successfully deleted ${Object.keys(result.deleted).length} images`);
      }
      
      if (result.not_found && result.not_found.length > 0) {
        console.warn(`Images not found in Cloudinary:`, result.not_found);
      }
    } catch (error) {
      console.error('Cloudinary deletion error:', error);
      throw new Error(`Failed to delete images: ${error.message}`);
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   * Converts: https://res.cloudinary.com/cloud/image/upload/v123/pazarone/products/img.jpg
   * To: pazarone/products/img
   */
  extractPublicIdFromUrl(url: string): string | null {
    if (!url) return null;

    try {
      // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
      const urlPattern =
        /\/upload\/(?:v\d+\/)?([^\/]+(?:\/[^\/]+)*?)(?:\.[^.]+)?$/;
      const match = url.match(urlPattern);

      if (match && match[1]) {
        return match[1];
      }

      // Fallback: try to extract from full URL path
      const pathMatch = url.match(/\/pazarone\/[^?]+/);
      if (pathMatch) {
        return pathMatch[0].replace(/^\//, '').replace(/\.[^.]+$/, '');
      }

      return null;
    } catch (error) {
      console.error('Failed to extract public ID from URL:', error);
      return null;
    }
  }
}
