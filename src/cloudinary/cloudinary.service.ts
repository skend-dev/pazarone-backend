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
          folder: `pazaro/${folder}`,
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
    try {
      await cloudinary.api.delete_resources(publicIds);
    } catch (error) {
      throw new Error(`Failed to delete images: ${error.message}`);
    }
  }
}
