import { setAuthCookies } from '@/server/http/auth';
import { json, parseBody, route } from '@/server/http/response';
import { clientIp, enforceRateLimit } from '@/server/lib/rate-limit';
import { credentialsSchema } from '@/server/lib/schemas';
import { registerUser } from '@/server/services/auth';

export const POST = route(async (request) => {
  await enforceRateLimit({ key: `register:${clientIp(request)}`, max: 5, windowSeconds: 900 });

  const { email, password } = await parseBody(request, credentialsSchema);
  const result = await registerUser(email, password, request.headers.get('user-agent'));

  return setAuthCookies(json({ user: result.user }, 201), result);
});
