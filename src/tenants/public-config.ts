import { readableForeground } from './utils/color.util';
import { TenantBranding } from './entities/tenant-branding.master.entity';
import { Tenant } from './entities/tenant.master.entity';

export const BRANDING_DEFAULTS = {
  primaryColor: '#2563EB',
  secondaryColor: '#0F172A',
  language: 'en',
};

export function buildPublicConfig(tenant: Tenant, b: TenantBranding | null) {
  const primary = b?.primaryColor ?? BRANDING_DEFAULTS.primaryColor;
  const secondary = b?.secondaryColor ?? BRANDING_DEFAULTS.secondaryColor;
  return {
    slug: tenant.slug,
    status: tenant.status,
    name: b?.displayName ?? tenant.name,
    shortName: b?.shortName ?? null,
    description: b?.description ?? null,
    logoUrl: b?.logoUrl ?? null,
    faviconUrl: b?.faviconUrl ?? null,
    language: b?.language ?? BRANDING_DEFAULTS.language,
    theme: {
      primary,
      primaryForeground: readableForeground(primary),
      secondary,
      secondaryForeground: readableForeground(secondary),
    },
  };
}