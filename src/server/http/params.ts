import { notFound } from '@/server/lib/errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: string, message = 'Resource not found') {
  if (!UUID_PATTERN.test(value)) {
    throw notFound(message);
  }

  return value;
}
