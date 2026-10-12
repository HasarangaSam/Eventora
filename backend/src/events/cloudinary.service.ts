import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {}

  async upload(buffer: Buffer, format: string): Promise<{ url: string; publicId: string }> {
    const client = this.client();
    return new Promise((resolve, reject) => {
      const stream = client.uploader.upload_stream(
        { folder: 'eventora/events', resource_type: 'image', format: format.slice('image/'.length), overwrite: false },
        (error, result) => {
          if (error || !result?.secure_url || !result.public_id) return reject(new ServiceUnavailableException('Cover image upload failed'));
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  async destroy(publicId: string): Promise<void> {
    const result = await this.client().uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new ServiceUnavailableException('Cover image removal failed');
    }
  }

  private client() {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Cover image service is not configured');
    }
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    return cloudinary;
  }
}
