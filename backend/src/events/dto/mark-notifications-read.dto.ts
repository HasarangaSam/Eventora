import { ArrayMaxSize, IsArray } from 'class-validator';

export class MarkOrganizerNotificationsReadDto {
  @IsArray({ message: 'notificationIds must contain up to 100 distinct notification IDs' })
  @ArrayMaxSize(100, { message: 'notificationIds must contain up to 100 distinct notification IDs' })
  notificationIds!: string[];
}
