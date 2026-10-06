import { IsDateString, IsString, Length } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @Length(2, 200)
  title: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;
}
