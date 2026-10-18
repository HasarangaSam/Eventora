import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @Length(2, 100, { message: 'name must be between 2 and 100 characters' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'slug must be a string' })
  @Length(2, 120, { message: 'slug must be between 2 and 120 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must contain lowercase letters, numbers, and single hyphens' })
  slug?: string;

  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @MaxLength(2000, { message: 'description must be at most 2000 characters' })
  description?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString({ message: 'name must be a string' })
  @Length(2, 100, { message: 'name must be between 2 and 100 characters' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'slug must be a string' })
  @Length(2, 120, { message: 'slug must be between 2 and 120 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must contain lowercase letters, numbers, and single hyphens' })
  slug?: string;

  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @MaxLength(2000, { message: 'description must be at most 2000 characters' })
  description?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}
