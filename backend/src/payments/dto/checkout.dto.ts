import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CheckoutDto {
  @IsString({ message: 'firstName must be a string' })
  @IsNotEmpty({ message: 'firstName is required' })
  @Length(1, 100, { message: 'firstName must be between 1 and 100 characters' })
  firstName!: string;

  @IsString({ message: 'lastName must be a string' })
  @IsNotEmpty({ message: 'lastName is required' })
  @Length(1, 100, { message: 'lastName must be between 1 and 100 characters' })
  lastName!: string;

  @IsString({ message: 'phone must be a string' })
  @IsNotEmpty({ message: 'phone is required' })
  @Length(5, 32, { message: 'phone must be between 5 and 32 characters' })
  phone!: string;

  @IsString({ message: 'address must be a string' })
  @IsNotEmpty({ message: 'address is required' })
  @Length(1, 200, { message: 'address must be between 1 and 200 characters' })
  address!: string;

  @IsString({ message: 'city must be a string' })
  @IsNotEmpty({ message: 'city is required' })
  @Length(1, 100, { message: 'city must be between 1 and 100 characters' })
  city!: string;

  @IsString({ message: 'country must be a string' })
  @IsNotEmpty({ message: 'country is required' })
  @Length(2, 80, { message: 'country must be between 2 and 80 characters' })
  country!: string;
}
