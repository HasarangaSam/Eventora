import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListRegistrationsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 10;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'EXPIRED']) status?: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
}
