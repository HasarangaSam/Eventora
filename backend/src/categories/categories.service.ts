import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const publicCategorySelect = { id: true, name: true, slug: true, description: true } as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(activeOnly = true) {
    return this.prisma.category.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
      select: { ...publicCategorySelect, isActive: true },
    });
  }

  async get(key: string) {
    const category = await this.prisma.category.findFirst({
      where: { OR: [{ id: key }, { slug: key }], isActive: true },
      select: publicCategorySelect,
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(name: string, slug: string, description: string | null) {
    try {
      return await this.prisma.category.create({
        data: { name, slug, description },
        select: { ...publicCategorySelect, isActive: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A category with that name or slug already exists');
      throw error;
    }
  }

  async update(id: string, data: { name?: string; slug?: string; description?: string | null; isActive?: boolean }) {
    if (!(await this.prisma.category.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Category not found');
    }
    try {
      return await this.prisma.category.update({
        where: { id },
        data,
        select: { ...publicCategorySelect, isActive: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A category with that name or slug already exists');
      throw error;
    }
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, _count: { select: { events: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category._count.events > 0) {
      throw new ConflictException('This category is referenced by events; deactivate it instead');
    }
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('This category is referenced by events; deactivate it instead');
      }
      throw error;
    }
    return { deleted: true };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003';
}
