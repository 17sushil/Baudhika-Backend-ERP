import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { Page } from '../../../common/dto/pagination.dto';
import { hasPermission } from '../access/scope.util';
import type { TenantAuth } from '../auth/auth.types';
import { TenantContext } from '../context/tenant-context';
import { AuditAction } from './audit.enums';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { AuditLog } from './entities/audit-log.tenant.entity';

export interface AuditEntry {
  table: string;
  recordId: string;
  action: AuditAction;
  before?: object | null;
  after?: object | null;
}

/** Never written to the audit log, whatever a caller passes in. */
const SECRET_KEYS = new Set(['passwordHash', 'tokenHash', 'codeHash', 'dbPasswordEnc']);

/**
 * Snapshot fields that stay behind their own permission when the log is read back: audit.read alone must
 * not become a way around person.sensitive.read, guardian.sensitive.read or student.health.read.
 */
const SENSITIVE: { table: string; permission: string; fields: string[] | 'all' }[] = [
  { table: 'student_health', permission: 'student.health.read', fields: 'all' },
  { table: 'persons', permission: 'person.sensitive.read', fields: ['religion', 'ethnicity'] },
  { table: 'guardians', permission: 'guardian.sensitive.read', fields: ['annualIncome'] },
];

/** Flat column snapshot: drops loaded relations and secrets, keeps scalars and dates. */
export function snapshot(
  row: object | null | undefined,
): Record<string, unknown> | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (SECRET_KEYS.has(k)) continue;
    if (v instanceof Date) out[k] = v.toISOString();
    else if (v === null || typeof v !== 'object') out[k] = v;
  }
  return out;
}

@Injectable()
export class AuditService {
  constructor(private ctx: TenantContext) {}

  /** Pass the transaction's manager so the log commits (or rolls back) with the change itself. */
  async record(
    actor: TenantAuth,
    e: AuditEntry,
    m: EntityManager = this.ctx.dataSource.manager,
  ) {
    const repo = m.getRepository(AuditLog);
    await repo.save(
      repo.create({
        tableName: e.table,
        recordId: e.recordId,
        action: e.action,
        oldData: snapshot(e.before),
        newData: snapshot(e.after),
        changedBy: actor.userId,
        ipAddress: actor.ip,
      }),
    );
  }

  async list(q: ListAuditLogsDto, auth: TenantAuth): Promise<Page<AuditLog>> {
    const qb = this.ctx
      .repo(AuditLog)
      .createQueryBuilder('a')
      .orderBy('a.id', 'DESC');
    if (q.tableName) qb.andWhere('a.table_name = :t', { t: q.tableName });
    if (q.recordId) qb.andWhere('a.record_id = :r', { r: q.recordId });
    if (q.changedBy) qb.andWhere('a.changed_by = :u', { u: q.changedBy });
    if (q.action) qb.andWhere('a.action = :act', { act: q.action });
    if (q.from) qb.andWhere('a.changed_at >= :from', { from: q.from });
    if (q.to) qb.andWhere('a.changed_at < :to', { to: q.to });
    const [items, total] = await qb
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
    return { items: items.map((a) => this.redact(a, auth)), total, page: q.page, limit: q.limit };
  }

  private redact(a: AuditLog, auth: TenantAuth): AuditLog {
    const rule = SENSITIVE.find((r) => r.table === a.tableName);
    if (!rule || hasPermission(auth, rule.permission)) return a;
    const strip = (d: Record<string, unknown> | null) => {
      if (!d) return d;
      if (rule.fields === 'all') return { redacted: `needs ${rule.permission}` };
      return Object.fromEntries(Object.entries(d).filter(([k]) => !rule.fields.includes(k)));
    };
    return { ...a, oldData: strip(a.oldData), newData: strip(a.newData) };
  }
}
