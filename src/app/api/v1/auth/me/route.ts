import { requireUser } from '@/server/http/auth';
import { json, route } from '@/server/http/response';
import { unauthorized } from '@/server/lib/errors';
import { findUserById, toPublicUser } from '@/server/services/auth';

export const GET = route(async (request) => {
  const { userId } = await requireUser(request);
  const user = await findUserById(userId);

  if (!user) {
    throw unauthorized();
  }

  return json({ user: toPublicUser(user) });
});
