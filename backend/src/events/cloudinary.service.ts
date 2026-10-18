import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService) {}

  async upload(buffer: Buffer, format: string): Promise<{ url: string; publicId: string }> {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    // In local development or staging without Cloudinary keys, store as durable base64 data URI
    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn('Cloudinary credentials not configured; using local data URI fallback for cover image.');
      const mime = format.startsWith('image/') ? format : `image/${format}`;
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
      const publicId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      return { url: dataUri, publicId };
    }

    // Configure credentials immediately before use to avoid stale global state.
    v2.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

    // Cloudinary's stream API is callback-based; resolve only when its durable public identifiers are present.
    return new Promise((resolve, reject) => {
      const stream = v2.uploader.upload_stream(
        // Note: omitting `format` so Cloudinary auto-detects it from the binary content.
        { folder: 'eventora/events', resource_type: 'image', overwrite: false },
        (error, result) => {
          if (error || !result?.secure_url || !result.public_id) {
            const details = error
              ? `HTTP ${error.http_code}: ${error.message}`
              : 'Cloudinary returned an incomplete upload response';
            this.logger.error(`Cloudinary cover image upload failed: ${details}`);
            return reject(new ServiceUnavailableException('Cover image upload failed'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  async destroy(publicId: string): Promise<void> {
    if (publicId.startsWith('local_')) {
      return;
    }
    const { cloudName, apiKey, apiSecret } = this.credentials();
    v2.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    const result = await v2.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new ServiceUnavailableException('Cover image removal failed');
    }
  }

  private credentials() {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Cover image service is not configured; set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    }
    return { cloudName, apiKey, apiSecret };
  }
}
