import { REFRESH_COOKIE } from '@/lib/constants';
import { clearAuthCookies, readCookie } from '@/server/http/auth';
import { json, route } from '@/server/http/response';
import { revokeSession } from '@/server/services/auth';

export const POST = route(async (request) => {
  const token = readCookie(request, REFRESH_COOKIE);

  if (token) {
    await revokeSession(token);
  }

  return clearAuthCookies(json({ success: true }));
});
