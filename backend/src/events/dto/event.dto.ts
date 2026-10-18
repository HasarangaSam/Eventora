import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

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

  @IsString({ message: 'startAt must be an ISO timestamp with timezone' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'startAt must be an ISO timestamp with timezone',
  })
  startAt!: string;

  @IsString({ message: 'endAt must be an ISO timestamp with timezone' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'endAt must be an ISO timestamp with timezone',
  })
  endAt!: string;

  @IsOptional()
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
  @IsString({ message: 'startAt must be an ISO timestamp with timezone' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'startAt must be an ISO timestamp with timezone',
  })
  startAt?: string;

  @IsOptional()
  @IsString({ message: 'endAt must be an ISO timestamp with timezone' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'endAt must be an ISO timestamp with timezone',
  })
  endAt?: string;

  @IsOptional()
  capacity?: number | null;
}

export class CreateSessionDto {
  @IsString({ message: 'title must be a string' })
  @IsNotEmpty({ message: 'title is required' })
  @Length(1, 200, { message: 'title must be between 1 and 200 characters' })
  title!: string;

  @IsOptional()
  description?: string | null;

  @IsOptional()
  speaker?: string | null;

  @IsOptional()
  venue?: string | null;

  @IsString({ message: 'startAt must be an ISO timestamp with timezone' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'startAt must be an ISO timestamp with timezone',
  })
  startAt!: string;

  @IsString({ message: 'endAt must be an ISO timestamp with timezone' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'endAt must be an ISO timestamp with timezone',
  })
  endAt!: string;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsString({ message: 'title must be a string' })
  @Length(1, 200, { message: 'title must be between 1 and 200 characters' })
  title?: string;

  @IsOptional()
  description?: string | null;

  @IsOptional()
  speaker?: string | null;

  @IsOptional()
  venue?: string | null;

  @IsOptional()
  @IsString({ message: 'startAt must be an ISO timestamp with timezone' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'startAt must be an ISO timestamp with timezone',
  })
  startAt?: string;

  @IsOptional()
  @IsString({ message: 'endAt must be an ISO timestamp with timezone' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'endAt must be an ISO timestamp with timezone',
  })
  endAt?: string;
}

export class CreateTicketTypeDto {
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @Length(1, 120, { message: 'name must be between 1 and 120 characters' })
  name!: string;

  @IsOptional()
  description?: string | null;

  @IsString({ message: 'price must be a decimal string' })
  @IsNotEmpty({ message: 'price is required' })
  price!: string;

  @IsString({ message: 'currency must be a string' })
  @Length(3, 3, { message: 'currency must be 3 characters' })
  currency!: string;

  @IsOptional()
  @IsInt({ message: 'quantity must be an integer' })
  quantity?: number;

  @IsOptional()
  salesStartAt?: string | null;

  @IsOptional()
  salesEndAt?: string | null;

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
  quantity?: number;

  @IsOptional()
  salesStartAt?: string | null;

  @IsOptional()
  salesEndAt?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}

export class SetTicketTypeActiveDto {
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive!: boolean;
}
