import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Full ISO-8601 datetime with mandatory timezone offset (or Z).
 * Accepts:  2024-06-15T10:00:00Z  |  2024-06-15T10:00:00.123+05:30
 */
const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

@ValidatorConstraint({ name: 'isIsoTimestamp', async: false })
class IsIsoTimestampConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value instanceof Date && Number.isFinite(value.getTime());
  }
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be an ISO timestamp with timezone`;
  }
}

/**
 * Composite decorator that:
 *  1. @Transform — converts a valid ISO timestamp string → Date; returns new Date(NaN) on invalid input
 *     so the custom validator below always receives a Date and can report the right message.
 *  2. Custom @ValidatorConstraint — asserts the result is a finite Date.
 *
 * Works with @IsOptional() (undefined passes through untouched).
 * Works with @ValidateIf(o => o.field !== null) for nullable fields.
 */
export function IsIsoTimestamp(validationOptions?: ValidationOptions): PropertyDecorator {
  return applyDecorators(
    Transform(({ value, obj, key }) => {
      if (value === undefined || value === null) return value;
      const raw =
        obj && key && typeof obj[key] === 'string'
          ? obj[key]
          : typeof value === 'string'
            ? value
            : null;
      if (!raw || !ISO_TIMESTAMP_REGEX.test(raw)) return new Date(NaN);
      return value instanceof Date && Number.isFinite(value.getTime())
        ? value
        : new Date(raw);
    }),
    (target: object, propertyKey: string | symbol) => {
      registerDecorator({
        target: target.constructor,
        propertyName: propertyKey as string,
        options: validationOptions,
        constraints: [],
        validator: IsIsoTimestampConstraint,
      });
    },
  );
}

/**
 * Lenient ISO-8601 date/datetime for query params.
 * Accepts:  2024-06-15  |  2024-06-15T10:00:00Z  |  2024-06-15T10:00+05:30
 */
const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

@ValidatorConstraint({ name: 'isIsoDate', async: false })
class IsIsoDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value instanceof Date && Number.isFinite(value.getTime());
  }
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid ISO date`;
  }
}

/**
 * Like @IsIsoTimestamp but allows a bare date (YYYY-MM-DD) without time.
 * Intended for query-string date range filters.
 */
export function IsIsoDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return applyDecorators(
    Transform(({ value, obj, key }) => {
      if (value === undefined || value === null) return value;
      const raw =
        obj && key && typeof obj[key] === 'string'
          ? obj[key]
          : typeof value === 'string'
            ? value
            : null;
      if (!raw || !ISO_DATE_REGEX.test(raw)) return new Date(NaN);
      return value instanceof Date && Number.isFinite(value.getTime())
        ? value
        : new Date(raw);
    }),
    (target: object, propertyKey: string | symbol) => {
      registerDecorator({
        target: target.constructor,
        propertyName: propertyKey as string,
        options: validationOptions,
        constraints: [],
        validator: IsIsoDateConstraint,
      });
    },
  );
}
