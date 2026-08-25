export interface ApiError {
  code: string;
  message: string;
  details?: { field: string; message: string }[];
}

export class RequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: { field: string; message: string }[];

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession() {
  refreshInFlight ??= fetch('/api/v1/auth/refresh', { method: 'POST' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function send(path: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new RequestError(
      response.status,
      payload?.error ?? { code: 'NETWORK_ERROR', message: 'Request failed' },
    );
  }

  return payload;
}

/**
 * Retries once behind a silent refresh so a 15 minute access token expiring mid-session
 * is invisible to the user. Concurrent 401s share a single refresh call.
 */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return (await send(path, init)) as T;
  } catch (error) {
    if (error instanceof RequestError && error.status === 401 && !path.includes('/auth/')) {
      if (await refreshSession()) {
        return (await send(path, init)) as T;
      }
    }

    throw error;
  }
}
