import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { ensureDto } from '../common/validation/dto-validator.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list(true);
  }

  @Get('admin/list')
  @UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
  @RequireRoles('ADMIN')
  listAll() {
    return this.categories.list(false);
  }

  @Get(':categoryId')
  get(@Param('categoryId') id: string) {
    return this.categories.get(id);
  }

  @Post()
  @UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
  @RequireRoles('ADMIN')
  create(@Body() body: CreateCategoryDto) {
    const dto = ensureDto(CreateCategoryDto, body);
    const name = dto.name.trim();
    const slug = dto.slug === undefined ? slugify(name) : dto.slug.trim().toLowerCase();
    const description = dto.description?.trim() || null;
    return this.categories.create(name, slug, description);
  }

  @Patch(':categoryId')
  @UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
  @RequireRoles('ADMIN')
  update(@Param('categoryId') id: string, @Body() body: UpdateCategoryDto) {
    const dto = ensureDto(UpdateCategoryDto, body);
    const data: { name?: string; slug?: string; description?: string | null; isActive?: boolean } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) data.slug = dto.slug.trim().toLowerCase();
    if (dto.description !== undefined) data.description = dto.description === null || dto.description.trim() === '' ? null : dto.description.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (!Object.keys(data).length) throw new BadRequestException('At least one category field is required');
    return this.categories.update(id, data);
  }

  @Delete(':categoryId')
  @UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
  @RequireRoles('ADMIN')
  remove(@Param('categoryId') id: string) {
    return this.categories.remove(id);
  }
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}
