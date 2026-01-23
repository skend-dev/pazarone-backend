import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: apiSecret,
      signature_algorithm: 'sha1', // Force SHA-1 (not SHA-256)
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
      const result = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
      });
      
      if (result.result === 'not found') {
        // Try with pazarone/ prefix
        if (!publicId.startsWith('pazarone/')) {
          const alternativeId = `pazarone/${publicId}`;
          const retryResult = await cloudinary.uploader.destroy(alternativeId, {
            invalidate: true,
          });
          if (retryResult.result === 'not found') {
            throw new Error(`Image not found: ${publicId} or ${alternativeId}`);
          }
        } else {
          throw new Error(`Image not found: ${publicId}`);
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Search for images in Cloudinary by folder prefix
   * Useful for finding orphaned images when product.images is empty
   */
  async searchImagesByFolder(
    folderPrefix: string,
    maxResults: number = 100,
  ): Promise<string[]> {
    try {
      const result = await cloudinary.search
        .expression(`folder:${folderPrefix}*`)
        .max_results(maxResults)
        .execute();

      return (
        result.resources?.map((resource: any) => resource.public_id) || []
      );
    } catch (error) {
      console.error('Failed to search Cloudinary images:', error);
      return [];
    }
  }

  async deleteMultipleImages(publicIds: string[]): Promise<void> {
    if (!publicIds || publicIds.length === 0) {
      return;
    }

    try {
      // Try to delete with the provided public IDs first
      let result = await cloudinary.api.delete_resources(publicIds, {
        resource_type: 'image',
        invalidate: true,
      });
      
      // If some images were not found, try alternative public ID formats
      if (result.not_found && result.not_found.length > 0) {
        // Generate alternative public ID formats to try
        const alternativePublicIds: string[] = [];
        for (const publicId of result.not_found) {
          // Try adding pazarone/ prefix if not present
          if (!publicId.startsWith('pazarone/')) {
            alternativePublicIds.push(`pazarone/${publicId}`);
            // Also try pazarone/products/ prefix
            if (!publicId.startsWith('products/')) {
              alternativePublicIds.push(`pazarone/products/${publicId}`);
            } else {
              alternativePublicIds.push(`pazarone/${publicId}`);
            }
          }
        }
        
        if (alternativePublicIds.length > 0) {
          const retryResult = await cloudinary.api.delete_resources(
            alternativePublicIds,
            {
              resource_type: 'image',
              invalidate: true,
            },
          );
          
          // Merge results
          if (retryResult.deleted) {
            result.deleted = { ...(result.deleted || {}), ...retryResult.deleted };
          }
          if (retryResult.not_found) {
            result.not_found = retryResult.not_found;
          }
        }
      }
      
      // Log deletion results
      if (result.deleted) {
        const deletedCount = Object.keys(result.deleted).length;
        console.log(`Successfully deleted ${deletedCount} image(s) from Cloudinary`);
      }
      
      if (result.not_found && result.not_found.length > 0) {
        console.warn(
          `${result.not_found.length} image(s) were not found in Cloudinary:`,
          result.not_found,
        );
      }
      
      if (result.failed && result.failed.length > 0) {
        console.error(
          `Failed to delete ${result.failed.length} image(s):`,
          result.failed,
        );
      }
    } catch (error) {
      console.error('Cloudinary deletion error:', error);
      throw new Error(`Failed to delete images: ${error.message}`);
    }
  }

  /**
   * Generate signed upload parameters for direct client-side uploads
   * Returns signature and other parameters needed for signed uploads
   * Uses HMAC-SHA1 signature generation matching Cloudinary's requirements
   */
  generateUploadSignature(folder?: string): {
    api_key: string;
    timestamp: number;
    signature: string;
    folder: string;
    cloud_name: string;
  } {
    const timestamp = Math.round(Date.now() / 1000);
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    let apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const defaultFolder = this.configService.get<string>(
      'CLOUDINARY_FOLDER',
      'products',
    );
    const uploadFolder = folder || defaultFolder;

    if (!apiKey || !apiSecret || !cloudName) {
      throw new Error(
        'Cloudinary configuration is missing. Please check environment variables.',
      );
    }

    // CRITICAL: Trim whitespace and remove quotes from API secret (common issues with .env files)
    let cleanedSecret = apiSecret.trim();
    
    // Remove surrounding quotes if present
    if (
      (cleanedSecret.startsWith('"') && cleanedSecret.endsWith('"')) ||
      (cleanedSecret.startsWith("'") && cleanedSecret.endsWith("'"))
    ) {
      cleanedSecret = cleanedSecret.slice(1, -1).trim();
      console.warn(
        '⚠️  WARNING: API Secret had quotes around it. Removed quotes automatically.',
      );
    }

    // Validate API secret length (Cloudinary API secrets are typically 40 characters)
    if (cleanedSecret.length < 30) {
      console.warn(
        `⚠️  WARNING: API Secret is only ${cleanedSecret.length} characters long. ` +
          `Cloudinary API secrets are typically 40 characters. ` +
          `Please verify you copied the complete API Secret from Cloudinary Dashboard → Settings → Security.`,
      );
    }

    // Use Cloudinary's built-in api_sign_request for reliable signature generation
    // This handles all the edge cases and ensures SHA-1 is used correctly
    const paramsToSign = {
      folder: uploadFolder,
      timestamp: timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      cleanedSecret,
    );


    return {
      api_key: apiKey,
      timestamp,
      signature,
      folder: uploadFolder,
      cloud_name: cloudName,
    };
  }

  /**
   * Extract public ID from Cloudinary URL
   * Handles multiple URL formats:
   * - https://res.cloudinary.com/cloud/image/upload/v123/products/img.jpg -> products/img
   * - https://res.cloudinary.com/cloud/image/upload/products/img.jpg -> products/img
   * - https://res.cloudinary.com/cloud/image/upload/v123/pazarone/products/img.jpg -> pazarone/products/img
   */
  extractPublicIdFromUrl(url: string): string | null {
    if (!url) return null;

    try {
      // Remove query parameters if present
      const cleanUrl = url.split('?')[0];
      
      // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
      // Pattern: /upload/ followed by optional version (v123/), then captures everything up to the file extension
      // Example: /upload/v1769090311/products/sapptqwuwo4u5vriuiqt.png -> products/sapptqwuwo4u5vriuiqt
      const urlPattern = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/;
      const match = cleanUrl.match(urlPattern);

      if (match && match[1]) {
        let publicId = match[1];
        // Remove trailing slash if present
        publicId = publicId.replace(/\/$/, '');
        
        // If public ID doesn't start with pazarone/, try to find it in the URL
        // Some URLs might have the full path, others might be relative
        if (!publicId.startsWith('pazarone/')) {
          // Check if URL contains pazarone folder structure
          const pazaroneMatch = cleanUrl.match(/\/upload\/(?:v\d+\/)?(pazarone\/.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/);
          if (pazaroneMatch && pazaroneMatch[1]) {
            publicId = pazaroneMatch[1].replace(/\/$/, '');
          }
        }
        
        return publicId;
      }

      // Fallback: try to extract from common folder patterns
      const fallbackPatterns = [
        /\/pazarone\/products\/[^\/\?]+/,
        /\/products\/[^\/\?]+/,
        /\/pazarone\/[^\/\?]+/,
      ];

      for (const pattern of fallbackPatterns) {
        const fallbackMatch = cleanUrl.match(pattern);
        if (fallbackMatch) {
          let publicId = fallbackMatch[0].replace(/^\//, '');
          // Remove file extension if present
          publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, '');
          return publicId;
        }
      }

      console.warn(`Could not extract public ID from URL: ${url}`);
      return null;
    } catch (error) {
      console.error('Failed to extract public ID from URL:', error);
      return null;
    }
  }
}
