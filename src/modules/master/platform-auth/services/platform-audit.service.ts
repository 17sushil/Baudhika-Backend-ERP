import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformAuditEvent } from '../entities/platform-audit-event.master.entity';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PlatformAuditService {
  constructor(
    @InjectRepository(PlatformAuditEvent) private repo: Repository<PlatformAuditEvent>,
  ) {}

  record(e: AuditInput) {
    return this.repo.save(
      this.repo.create({
        actorId: e.actorId ?? null,
        action: e.action,
        targetType: e.targetType ?? null,
        targetId: e.targetId ?? null,
        metadata: e.metadata ?? null,
      }),
    );
  }
}