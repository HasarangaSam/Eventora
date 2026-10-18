import { IsIn, IsNotEmpty, IsString, Length } from 'class-validator';

export class CheckinDto {
  @IsString({ message: 'eventId must be a string' })
  @IsNotEmpty({ message: 'eventId is required' })
  @Length(1, 64, { message: 'eventId is required' })
  eventId!: string;

  @IsString({ message: 'value must be a string' })
  @IsNotEmpty({ message: 'value is required' })
  @Length(1, 256, { message: 'value must be between 1 and 256 characters' })
  value!: string;

  @IsIn(['QR_SCAN', 'MANUAL_REFERENCE'], { message: 'method must be QR_SCAN or MANUAL_REFERENCE' })
  method!: 'QR_SCAN' | 'MANUAL_REFERENCE';
}

export class CheckinForEventDto {
  @IsString({ message: 'value must be a string' })
  @IsNotEmpty({ message: 'value is required' })
  @Length(1, 256, { message: 'value must be between 1 and 256 characters' })
  value!: string;

  @IsIn(['QR_SCAN', 'MANUAL_REFERENCE'], { message: 'method must be QR_SCAN or MANUAL_REFERENCE' })
  method!: 'QR_SCAN' | 'MANUAL_REFERENCE';
}
