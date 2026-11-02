/** Stricter per-IP limit for credential endpoints (login, OTP, refresh). Account lockout backs it up across IPs. */
export const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
