import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export function ensureDto<T extends object>(cls: new () => T, value: unknown): T {
  if (value instanceof cls) {
    const errors = validateSync(value, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      throw formatValidationError(errors[0]);
    }
    return value;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('A JSON object is required');
  }

  const instance = plainToInstance(cls, value);
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    throw formatValidationError(errors[0]);
  }

  return instance;
}

function formatValidationError(error: any): BadRequestException {
  if (error.constraints) {
    const firstKey = Object.keys(error.constraints)[0];
    return new BadRequestException(error.constraints[firstKey]);
  }
  if (error.children && error.children.length > 0) {
    return formatValidationError(error.children[0]);
  }
  return new BadRequestException('Validation failed');
}
