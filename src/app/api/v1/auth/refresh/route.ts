import { REFRESH_COOKIE } from '@/lib/constants';
import { clearAuthCookies, readCookie, setAuthCookies } from '@/server/http/auth';
import { handleError, json, route } from '@/server/http/response';
import { unauthorized } from '@/server/lib/errors';
import { rotateSession } from '@/server/services/auth';

export const POST = route(async (request) => {
  const token = readCookie(request, REFRESH_COOKIE);

  if (!token) {
    throw unauthorized('No session to refresh');
  }

  try {
    const result = await rotateSession(token, request.headers.get('user-agent'));
    return setAuthCookies(json({ user: result.user }), result);
  } catch (error) {
    // The cookie is dead either way, so clear it instead of letting the client retry.
    return clearAuthCookies(handleError(error));
  }
});
