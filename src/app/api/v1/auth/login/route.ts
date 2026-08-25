import { setAuthCookies } from '@/server/http/auth';
import { json, parseBody, route } from '@/server/http/response';
import { clientIp, enforceRateLimit } from '@/server/lib/rate-limit';
import { credentialsSchema } from '@/server/lib/schemas';
import { loginUser } from '@/server/services/auth';

export const POST = route(async (request) => {
  const { email, password } = await parseBody(request, credentialsSchema);

  // Limited per address as well as per email, so neither a single client nor a
  // distributed attempt at one account can brute force a password.
  await enforceRateLimit({ key: `login:ip:${clientIp(request)}`, max: 20, windowSeconds: 900 });
  await enforceRateLimit({ key: `login:email:${email}`, max: 10, windowSeconds: 900 });

  const result = await loginUser(email, password, request.headers.get('user-agent'));

  return setAuthCookies(json({ user: result.user }), result);
});
