import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { EventVisibility } from '../../generated/prisma/enums.js';

export class CreateEventDto {
  @IsString()
  @Length(3, 200)
  title: string;

  @IsString()
  @Length(10, 10000)
  description: string;

  @IsString()
  @Length(2, 200)
  venue: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsEnum(EventVisibility)
  visibility?: EventVisibility;
}
