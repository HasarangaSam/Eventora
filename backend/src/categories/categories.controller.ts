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
  create(@Body() body: unknown) {
    const input = objectBody(body);
    const name = textField(input, 'name', 2, 100);
    const slug = input.slug === undefined ? slugify(name) : textField(input, 'slug', 2, 120).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException('slug must contain lowercase letters, numbers, and single hyphens');
    }
    return this.categories.create(name, slug, optionalDescription(input.description));
  }

  @Patch(':categoryId')
  @UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
  @RequireRoles('ADMIN')
  update(@Param('categoryId') id: string, @Body() body: unknown) {
    const input = objectBody(body);
    const data: { name?: string; slug?: string; description?: string | null; isActive?: boolean } = {};
    if ('name' in input) data.name = textField(input, 'name', 2, 100);
    if ('slug' in input) {
      data.slug = textField(input, 'slug', 2, 120).toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
        throw new BadRequestException('slug must contain lowercase letters, numbers, and single hyphens');
      }
    }
    if ('description' in input) data.description = optionalDescription(input.description);
    if ('isActive' in input) {
      if (typeof input.isActive !== 'boolean') throw new BadRequestException('isActive must be a boolean');
      data.isActive = input.isActive;
    }
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

function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('A JSON object is required');
  }
  return value as Record<string, unknown>;
}

function textField(body: Record<string, unknown>, field: string, min: number, max: number): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new BadRequestException(`${field} must be between ${min} and ${max} characters`);
  }
  return value.trim();
}

function optionalDescription(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 2000) {
    throw new BadRequestException('description must be at most 2000 characters');
  }
  return value.trim();
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}
