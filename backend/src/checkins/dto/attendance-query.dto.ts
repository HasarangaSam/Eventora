import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AttendanceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a positive integer' })
  @Min(1, { message: 'page must be a positive integer' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be a positive integer' })
  @Min(1, { message: 'pageSize must be a positive integer' })
  @Max(100, { message: 'pageSize cannot exceed 100' })
  pageSize?: number = 25;
}
