import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateRegistrationDto {
  @IsUUID()
  ticketTypeId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
