import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsIsoTimestamp } from '../../common/validation/is-iso-timestamp.decorator.js';

export class CreateEventDto {
  @IsString({ message: 'title must be a string' })
  @IsNotEmpty({ message: 'title is required' })
  @Length(1, 200, { message: 'title must be between 1 and 200 characters' })
  title!: string;

  @IsString({ message: 'description must be a string' })
  @IsNotEmpty({ message: 'description is required' })
  @Length(1, 20_000, { message: 'description must be between 1 and 20000 characters' })
  description!: string;

  @IsString({ message: 'venue must be a string' })
  @IsNotEmpty({ message: 'venue is required' })
  @Length(1, 200, { message: 'venue must be between 1 and 200 characters' })
  venue!: string;

  @IsString({ message: 'city must be a string' })
  @IsNotEmpty({ message: 'city is required' })
  @Length(1, 200, { message: 'city must be between 1 and 200 characters' })
  city!: string;

  @IsString({ message: 'timezone must be a string' })
  @IsNotEmpty({ message: 'timezone is required' })
  @Length(1, 200, { message: 'timezone must be between 1 and 200 characters' })
  timezone!: string;

  @IsString({ message: 'categoryId must be a string' })
  @IsNotEmpty({ message: 'categoryId is required' })
  @Length(1, 200, { message: 'categoryId must be between 1 and 200 characters' })
  categoryId!: string;

  /** Validated and transformed to Date by @IsIsoTimestamp */
  @IsIsoTimestamp()
  startAt!: Date;

  /** Validated and transformed to Date by @IsIsoTimestamp */
  @IsIsoTimestamp()
  endAt!: Date;

  @IsOptional()
  @ValidateIf((o) => o.capacity !== null && o.capacity !== undefined)
  @IsInt({ message: 'capacity must be an integer' })
  @Min(1, { message: 'capacity must be at least 1' })
  @Max(1_000_000, { message: 'capacity must be at most 1000000' })
  capacity?: number | null;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString({ message: 'title must be a string' })
  @Length(1, 200, { message: 'title must be between 1 and 200 characters' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @Length(1, 20_000, { message: 'description must be between 1 and 20000 characters' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'venue must be a string' })
  @Length(1, 200, { message: 'venue must be between 1 and 200 characters' })
  venue?: string;

  @IsOptional()
  @IsString({ message: 'city must be a string' })
  @Length(1, 200, { message: 'city must be between 1 and 200 characters' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'timezone must be a string' })
  @Length(1, 200, { message: 'timezone must be between 1 and 200 characters' })
  timezone?: string;

  @IsOptional()
  @IsString({ message: 'categoryId must be a string' })
  @Length(1, 200, { message: 'categoryId must be between 1 and 200 characters' })
  categoryId?: string;

  @IsOptional()
  @IsIsoTimestamp()
  startAt?: Date;

  @IsOptional()
  @IsIsoTimestamp()
  endAt?: Date;

  @IsOptional()
  @ValidateIf((o) => o.capacity !== null && o.capacity !== undefined)
  @IsInt({ message: 'capacity must be an integer' })
  @Min(1, { message: 'capacity must be at least 1' })
  @Max(1_000_000, { message: 'capacity must be at most 1000000' })
  capacity?: number | null;
}

export class CreateSessionDto {
  @IsString({ message: 'title must be a string' })
  @IsNotEmpty({ message: 'title is required' })
  @Length(1, 200, { message: 'title must be between 1 and 200 characters' })
  title!: string;

  @IsOptional()
  @ValidateIf((o) => o.description !== null && o.description !== '')
  @IsString({ message: 'description must be a string' })
  @MaxLength(2000, { message: 'description must be at most 2000 characters' })
  description?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.speaker !== null && o.speaker !== '')
  @IsString({ message: 'speaker must be a string' })
  @MaxLength(200, { message: 'speaker must be at most 200 characters' })
  speaker?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.venue !== null && o.venue !== '')
  @IsString({ message: 'venue must be a string' })
  @MaxLength(200, { message: 'venue must be at most 200 characters' })
  venue?: string | null;

  @IsIsoTimestamp()
  startAt!: Date;

  @IsIsoTimestamp()
  endAt!: Date;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsString({ message: 'title must be a string' })
  @Length(1, 200, { message: 'title must be between 1 and 200 characters' })
  title?: string;

  @IsOptional()
  @ValidateIf((o) => o.description !== null && o.description !== '')
  @IsString({ message: 'description must be a string' })
  @MaxLength(2000, { message: 'description must be at most 2000 characters' })
  description?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.speaker !== null && o.speaker !== '')
  @IsString({ message: 'speaker must be a string' })
  @MaxLength(200, { message: 'speaker must be at most 200 characters' })
  speaker?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.venue !== null && o.venue !== '')
  @IsString({ message: 'venue must be a string' })
  @MaxLength(200, { message: 'venue must be at most 200 characters' })
  venue?: string | null;

  @IsOptional()
  @IsIsoTimestamp()
  startAt?: Date;

  @IsOptional()
  @IsIsoTimestamp()
  endAt?: Date;
}

export class CreateTicketTypeDto {
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @Length(1, 120, { message: 'name must be between 1 and 120 characters' })
  name!: string;

  @IsOptional()
  @ValidateIf((o) => o.description !== null && o.description !== '')
  @IsString({ message: 'description must be a string' })
  @MaxLength(2000, { message: 'description must be at most 2000 characters' })
  description?: string | null;

  @IsString({ message: 'price must be a decimal string' })
  @IsNotEmpty({ message: 'price is required' })
  price!: string;

  @IsString({ message: 'currency must be a string' })
  @Length(3, 3, { message: 'currency must be 3 characters' })
  currency!: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity!: number;

  @IsOptional()
  @ValidateIf((o) => o.salesStartAt !== null)
  @IsIsoTimestamp()
  salesStartAt?: Date | null;

  @IsOptional()
  @ValidateIf((o) => o.salesEndAt !== null)
  @IsIsoTimestamp()
  salesEndAt?: Date | null;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}

export class UpdateTicketTypeDto {
  @IsOptional()
  @IsString({ message: 'name must be a string' })
  @Length(1, 120, { message: 'name must be between 1 and 120 characters' })
  name?: string;

  @IsOptional()
  @ValidateIf((o) => o.description !== null && o.description !== '')
  @IsString({ message: 'description must be a string' })
  @MaxLength(2000, { message: 'description must be at most 2000 characters' })
  description?: string | null;

  @IsOptional()
  @IsString({ message: 'price must be a decimal string' })
  price?: string;

  @IsOptional()
  @IsString({ message: 'currency must be a string' })
  @Length(3, 3, { message: 'currency must be 3 characters' })
  currency?: string;

  @IsOptional()
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity?: number;

  @IsOptional()
  @ValidateIf((o) => o.salesStartAt !== null && o.salesStartAt !== undefined)
  @IsIsoTimestamp()
  salesStartAt?: Date | null;

  @IsOptional()
  @ValidateIf((o) => o.salesEndAt !== null && o.salesEndAt !== undefined)
  @IsIsoTimestamp()
  salesEndAt?: Date | null;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}

export class SetTicketTypeActiveDto {
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive!: boolean;
}
