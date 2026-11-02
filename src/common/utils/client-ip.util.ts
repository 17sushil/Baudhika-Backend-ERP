import type { Request } from 'express';

/** req.ip honours the `trust proxy` setting, so X-Forwarded-For is only used behind a known proxy. */
export function clientIp(req: Request): string | null {
  return req.ip ?? req.socket?.remoteAddress ?? null;
}
