import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitOrganizerApplicationDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 200, { message: 'organizationName must be between 2 and 200 characters' })
  organizationName!: string;

  @IsString()
  @IsNotEmpty()
  @Length(20, 5000, { message: 'description must be between 20 and 5000 characters' })
  description!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 200, { message: 'contactName must be between 2 and 200 characters' })
  contactName!: string;

  @IsString()
  @IsNotEmpty()
  @Length(7, 40, { message: 'contactPhone must be between 7 and 40 characters' })
  @Matches(/^\+?[0-9().\s-]{7,40}$/, { message: 'contactPhone must be a valid phone number' })
  contactPhone!: string;

  @IsIn(['INDIVIDUAL', 'COMPANY', 'EDUCATIONAL_INSTITUTION', 'NONPROFIT', 'OTHER'], {
    message: 'Select a valid organizer type',
  })
  organizerType!: 'INDIVIDUAL' | 'COMPANY' | 'EDUCATIONAL_INSTITUTION' | 'NONPROFIT' | 'OTHER';

  @IsString()
  @IsNotEmpty()
  @Length(2, 100, { message: 'country must be between 2 and 100 characters' })
  country!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 120, { message: 'city must be between 1 and 120 characters' })
  city!: string;

  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_tld: true, require_protocol: true },
    { message: 'websiteUrl must be an HTTP or HTTPS URL' },
  )
  @MaxLength(2048, { message: 'websiteUrl must be an HTTP or HTTPS URL' })
  websiteUrl?: string | null;

  @IsString()
  @IsNotEmpty()
  @Length(10, 5000, { message: 'experience must be between 10 and 5000 characters' })
  experience!: string;

  @IsIn(['ONE_TIME', 'OCCASIONALLY', 'MONTHLY', 'FREQUENTLY'], {
    message: 'Select an expected event frequency',
  })
  eventFrequency!: 'ONE_TIME' | 'OCCASIONALLY' | 'MONTHLY' | 'FREQUENTLY';

  @IsInt({ message: 'expectedAttendance must be between 1 and 1000000' })
  @Min(1, { message: 'expectedAttendance must be between 1 and 1000000' })
  @Max(1_000_000, { message: 'expectedAttendance must be between 1 and 1000000' })
  expectedAttendance!: number;

  @IsArray({ message: 'Select one or more distinct Eventora categories' })
  @ArrayMinSize(1, { message: 'Select one or more distinct Eventora categories' })
  @ArrayMaxSize(20, { message: 'Select one or more distinct Eventora categories' })
  @ArrayUnique({ message: 'Select one or more distinct Eventora categories' })
  @IsString({ each: true, message: 'Select one or more distinct Eventora categories' })
  @MaxLength(64, { each: true, message: 'Select one or more distinct Eventora categories' })
  categoryIds!: string[];

  @Equals(true, { message: 'Both application confirmations are required' })
  accuracyConfirmed!: boolean;

  @Equals(true, { message: 'Both application confirmations are required' })
  rulesAccepted!: boolean;
}

export class DecideApplicationDto {
  @IsIn(['APPROVED', 'REJECTED'], { message: 'status must be APPROVED or REJECTED' })
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @Length(1, 2000, { message: 'decisionNote must be between 1 and 2000 characters' })
  decisionNote?: string | null;
}

export class SetUserRoleDto {
  @IsIn(['ATTENDEE', 'ORGANIZER', 'ADMIN'], { message: 'role must be ATTENDEE, ORGANIZER, or ADMIN' })
  role!: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
}

export class SetUserStatusDto {
  @IsIn(['ACTIVE', 'DEACTIVATED'], { message: 'status must be ACTIVE or DEACTIVATED' })
  status!: 'ACTIVE' | 'DEACTIVATED';
}

export class MarkNotificationsReadDto {
  @IsArray({ message: 'notificationIds must contain up to 100 distinct notification IDs' })
  @ArrayMaxSize(100, { message: 'notificationIds must contain up to 100 distinct notification IDs' })
  @ArrayUnique({ message: 'notificationIds must contain up to 100 distinct notification IDs' })
  @IsString({ each: true, message: 'each notificationId must be a string' })
  @MaxLength(255, { each: true, message: 'each notificationId must be at most 255 characters' })
  notificationIds!: string[];
}

export class ListApplicationsQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'], { message: 'status must be PENDING, APPROVED, or REJECTED' })
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}
