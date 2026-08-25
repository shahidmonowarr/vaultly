/** Share links must point at the host the browser used, not at an internal URL. */
export function getOrigin(request: Request) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) {
    return new URL(request.url).origin;
  }

  const protocol = request.headers.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`;
}
