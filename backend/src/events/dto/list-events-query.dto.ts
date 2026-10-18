import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IsIsoDate } from '../../common/validation/is-iso-timestamp.decorator.js';

export class ListEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a positive integer' })
  @Min(1, { message: 'page must be a positive integer' })
  @Max(10_000, { message: 'page must be between 1 and 10000' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be a positive integer' })
  @Min(1, { message: 'pageSize must be between 12 and 48' })
  @Max(48, { message: 'pageSize must be between 12 and 48' })
  pageSize?: number = 12;

  @IsOptional()
  @IsString({ message: 'search must be a string' })
  @MaxLength(120, { message: 'search must be at most 120 characters' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'categoryId must be a string' })
  @MaxLength(120, { message: 'categoryId is invalid' })
  categoryId?: string;

  @IsOptional()
  @IsIsoDate()
  from?: Date;

  @IsOptional()
  @IsIsoDate()
  to?: Date;

  @IsOptional()
  @IsIn(['startAt', 'newest', 'title'], { message: 'sort must be startAt, newest, or title' })
  sort?: 'startAt' | 'newest' | 'title' = 'startAt';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'direction must be asc or desc' })
  direction?: 'asc' | 'desc';
}
