import { ArrayMaxSize, ArrayUnique, IsArray, IsString, MaxLength } from 'class-validator';

export class MarkOrganizerNotificationsReadDto {
  @IsArray({ message: 'notificationIds must contain up to 100 distinct notification IDs' })
  @ArrayMaxSize(100, { message: 'notificationIds must contain up to 100 distinct notification IDs' })
  @ArrayUnique({ message: 'notificationIds must contain up to 100 distinct notification IDs' })
  @IsString({ each: true, message: 'each notificationId must be a string' })
  @MaxLength(255, { each: true, message: 'each notificationId must be at most 255 characters' })
  notificationIds!: string[];
}
