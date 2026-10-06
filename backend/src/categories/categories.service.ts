import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { createSlug } from './utils/slug.util.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    return category;
  }

  async create(createCategoryDto: CreateCategoryDto) {
    const name = createCategoryDto.name.trim();
    const slug = createSlug(name);

    if (!slug) {
      throw new ConflictException('Category name cannot produce a valid slug.');
    }

    const existingName = await this.prisma.category.findUnique({
      where: {
        name,
      },
    });

    if (existingName) {
      throw new ConflictException('A category with this name already exists.');
    }

    const existingSlug = await this.prisma.category.findUnique({
      where: {
        slug,
      },
    });

    if (existingSlug) {
      throw new ConflictException('A category with this name already exists.');
    }

    return this.prisma.category.create({
      data: {
        name,
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const existingCategory = await this.prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!existingCategory) {
      throw new NotFoundException('Category not found.');
    }

    const name = updateCategoryDto.name.trim();
    const slug = createSlug(name);

    if (!slug) {
      throw new ConflictException('Category name cannot produce a valid slug.');
    }

    const duplicate = await this.prisma.category.findFirst({
      where: {
        OR: [
          {
            name,
            NOT: {
              id,
            },
          },
          {
            slug,
            NOT: {
              id,
            },
          },
        ],
      },
    });

    if (duplicate) {
      throw new ConflictException('A category with this name already exists.');
    }

    return this.prisma.category.update({
      where: {
        id,
      },
      data: {
        name,
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        _count: {
          select: {
            events: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    if (category._count.events > 0) {
      throw new ConflictException('Cannot delete a category that has events.');
    }

    await this.prisma.category.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Category deleted successfully.',
    };
  }
}
