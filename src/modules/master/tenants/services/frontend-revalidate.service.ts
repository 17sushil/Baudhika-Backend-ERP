import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FrontendRevalidateService {
  private readonly logger = new Logger(FrontendRevalidateService.name);

  constructor(private config: ConfigService) {}

  async revalidateHosts(hosts: string[]) {
    const url = this.config.get<string>('FRONTEND_REVALIDATE_URL');
    const secret = this.config.get<string>('FRONTEND_REVALIDATE_SECRET');
    if (!url || !secret) return; // not configured: the frontend cache just expires by TTL

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ hosts }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) this.logger.warn(`Frontend revalidate returned ${res.status}`);
    } catch (e) {
      this.logger.warn(`Frontend revalidate failed: ${(e as Error).message}`);
    }
  }
}