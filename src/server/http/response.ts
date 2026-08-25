import { NextResponse } from 'next/server';
import { ZodError, type TypeOf, type ZodTypeAny } from 'zod';
import { AppError, badRequest } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<TypeOf<S>> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw badRequest('Expected a JSON request body');
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw badRequest('Request body is not valid JSON');
  }

  return schema.parse(payload);
}

export function parseQuery<S extends ZodTypeAny>(request: Request, schema: S): TypeOf<S> {
  const params = new URL(request.url).searchParams;
  return schema.parse(Object.fromEntries(params.entries()));
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return errorResponse(422, 'VALIDATION_FAILED', 'Request validation failed', details);
  }

  if (error instanceof AppError) {
    return errorResponse(error.statusCode, error.code, error.message, error.details);
  }

  logger.error('unhandled request error', {
    error: error instanceof Error ? error.stack : String(error),
  });

  return errorResponse(500, 'INTERNAL_ERROR', 'Something went wrong on our side');
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleError(error);
    }
  };
}
