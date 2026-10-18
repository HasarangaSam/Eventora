import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service.js';

describe('CloudinaryService', () => {
  it('falls back to local data URI when Cloudinary is not configured', async () => {
    const config = { get: vi.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const service = new CloudinaryService(config);

    const buffer = Buffer.from([1, 2, 3, 4]);
    const result = await service.upload(buffer, 'image/png');

    expect(result.url).toBe(`data:image/png;base64,${buffer.toString('base64')}`);
    expect(result.publicId).toMatch(/^local_\d+_/);

    // Destroy on local ID should resolve without error
    await expect(service.destroy(result.publicId)).resolves.toBeUndefined();
  });
});
