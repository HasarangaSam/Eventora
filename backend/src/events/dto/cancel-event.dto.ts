import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CancelEventDto {
  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required' })
  @Length(5, 1000, { message: 'reason must be between 5 and 1000 characters' })
  reason!: string;
}
