import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ParticipantsQueryDto {
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

  @IsOptional()
  @IsString({ message: 'search must be a string' })
  @MaxLength(120, { message: 'search must be at most 120 characters' })
  search?: string;

  @IsOptional()
  @IsIn(['PENDING', 'CONFIRMED', 'EXPIRED'], { message: 'registrationStatus is invalid' })
  registrationStatus?: 'PENDING' | 'CONFIRMED' | 'EXPIRED';

  @IsOptional()
  @IsIn(['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CHARGEDBACK', 'UNPAID'], {
    message: 'paymentStatus is invalid',
  })
  paymentStatus?: 'INITIATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CHARGEDBACK' | 'UNPAID';

  @IsOptional()
  @IsIn(['CHECKED_IN', 'NOT_CHECKED_IN'], { message: 'checkInStatus is invalid' })
  checkInStatus?: 'CHECKED_IN' | 'NOT_CHECKED_IN';
}
