import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateRegistrationDto {
  @IsString({ message: 'ticketTypeId must be a string' })
  @IsNotEmpty({ message: 'ticketTypeId is required' })
  ticketTypeId!: string;

  @IsInt({ message: 'quantity must be a positive integer' })
  @Min(1, { message: 'quantity must be a positive integer' })
  @Max(2_147_483_647, { message: 'quantity must be a positive integer' })
  quantity!: number;
}
