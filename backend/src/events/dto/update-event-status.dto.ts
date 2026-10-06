import { IsEnum } from 'class-validator';
import { EventStatus } from '../../generated/prisma/enums.js';

export class UpdateEventStatusDto {
  @IsEnum(EventStatus)
  status: EventStatus;
}
