import { ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('CategoriesService', () => {
  it('only lists active categories for public discovery', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new CategoriesService({ category: { findMany } } as unknown as PrismaService);
    await service.list();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true }, orderBy: { name: 'asc' } }));
  });

  it('preserves categories referenced by event history', async () => {
    const category = { findUnique: vi.fn().mockResolvedValue({ id: 'cat_1', _count: { events: 2 } }), delete: vi.fn() };
    const service = new CategoriesService({ category } as unknown as PrismaService);
    await expect(service.remove('cat_1')).rejects.toBeInstanceOf(ConflictException);
    expect(category.delete).not.toHaveBeenCalled();
  });

  it('deletes a category only when no event references it', async () => {
    const category = { findUnique: vi.fn().mockResolvedValue({ id: 'cat_1', _count: { events: 0 } }), delete: vi.fn() };
    const service = new CategoriesService({ category } as unknown as PrismaService);
    await expect(service.remove('cat_1')).resolves.toEqual({ deleted: true });
    expect(category.delete).toHaveBeenCalledWith({ where: { id: 'cat_1' } });
  });
});
