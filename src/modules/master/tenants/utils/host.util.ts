export const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'app', 'platform', 'static', 'assets', 'cdn',
  'mail', 'smtp', 'support', 'status', 'docs', 'help', 'login', 'auth',
]);

// 3-30 chars, lowercase letters/digits/hyphens, no leading or trailing hyphen
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !slug.includes('--') && !RESERVED_SLUGS.has(slug);
}

export type HostKey = { slug: string } | { domain: string };

/** "sunrise.erp.com:443" -> { slug: "sunrise" }; "portal.school.edu" -> { domain }. */
export function parseHost(rawHost: string, baseDomain: string): HostKey | null {
  const host = rawHost.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return null;

  if (host.endsWith(`.${baseDomain}`)) {
    const label = host.slice(0, -(baseDomain.length + 1));
    return isValidSlug(label) ? { slug: label } : null; // "a.b.erp.com" and reserved names fail here
  }
  return { domain: host };
}