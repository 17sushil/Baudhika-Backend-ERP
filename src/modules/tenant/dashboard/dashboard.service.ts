import { ForbiddenException, Injectable } from '@nestjs/common';
import { today } from '../../../common/utils/date.util';
import { campusScope, hasPermission } from '../access/scope.util';
import type { TenantAuth } from '../auth/auth.types';
import { TenantContext } from '../context/tenant-context';
import { Gender } from '../people/people.enums';
import { StaffKind } from '../staff/staff.enums';
import { StudentStatus } from '../students/students.enums';
import { KpiQueryDto } from './dto/kpi.dto';

type CampusFilter = string[] | null; // null = whole institution
const zeros = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>;

/** Dashboard counters. Every number respects the caller's campus scope and section permission. */
@Injectable()
export class DashboardService {
  constructor(private ctx: TenantContext) {}

  async kpis(q: KpiQueryDto, auth: TenantAuth) {
    const students = this.filterFor(auth, 'student.read', q.campusId);
    const staff = this.filterFor(auth, 'staff.read', q.campusId);
    if (students === 'denied' && staff === 'denied') {
      throw new ForbiddenException(q.campusId ? 'No access to this campus' : 'Missing permission');
    }

    const filters = [students, staff].filter((f): f is CampusFilter => f !== 'denied');
    const institution = filters.every((f) => f === null);
    const [studentKpis, staffKpis] = await Promise.all([
      students === 'denied' ? undefined : this.studentKpis(students),
      staff === 'denied' ? undefined : this.staffKpis(staff),
    ]);
    return {
      scope: institution ? ('institution' as const) : ('campus' as const),
      campusIds: institution ? null : [...new Set(filters.flatMap((f) => f ?? []))],
      generatedAt: new Date(),
      ...(studentKpis ? { students: studentKpis } : {}),
      ...(staffKpis ? { staff: staffKpis } : {}),
    };
  }

  /** Campuses to count for a section, or 'denied' when the caller can't see it (at all, or on that campus). */
  private filterFor(auth: TenantAuth, perm: string, campusId?: string): CampusFilter | 'denied' {
    if (!hasPermission(auth, perm)) return 'denied';
    const scope = campusScope(auth, perm);
    if (!campusId) return scope;
    return scope === null || scope.includes(campusId) ? [campusId] : 'denied';
  }

  private async studentKpis(campusIds: CampusFilter) {
    const ds = this.ctx.dataSource;
    const where = `s.deleted_at IS NULL AND ($1::uuid[] IS NULL OR s.campus_id = ANY($1::uuid[]))`;
    const [[head], statuses, genders, byCampus] = await Promise.all([
      ds.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE s.status = 'active')::int AS enrolled,
                count(*) FILTER (WHERE s.status = 'applicant')::int AS applicants,
                count(*) FILTER (WHERE s.admission_date >= date_trunc('month', $2::date))::int AS "admissionsThisMonth",
                count(*) FILTER (WHERE s.admission_date >= date_trunc('year', $2::date))::int AS "admissionsThisYear"
           FROM students s WHERE ${where}`,
        [campusIds, today()],
      ),
      ds.query(`SELECT s.status::text AS k, count(*)::int AS n FROM students s WHERE ${where} GROUP BY 1`, [campusIds]),
      ds.query(
        `SELECT coalesce(p.gender::text, 'unknown') AS k, count(*)::int AS n
           FROM students s JOIN persons p ON p.id = s.person_id
          WHERE ${where} AND s.status = 'active' GROUP BY 1`,
        [campusIds],
      ),
      this.byCampus('students', `s.status = 'active'`, campusIds),
    ]);
    return {
      ...head,
      byStatus: { ...zeros(Object.values(StudentStatus)), ...this.toMap(statuses) },
      byGender: { ...zeros([...Object.values(Gender), 'unknown']), ...this.toMap(genders) },
      byCampus,
    };
  }

  private async staffKpis(campusIds: CampusFilter) {
    const ds = this.ctx.dataSource;
    const where = `s.deleted_at IS NULL AND ($1::uuid[] IS NULL OR s.campus_id = ANY($1::uuid[]))`;
    const [[head], types, byCampus] = await Promise.all([
      ds.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE s.status IN ('active', 'on_leave'))::int AS current,
                count(*) FILTER (WHERE s.status = 'active')::int AS active,
                count(*) FILTER (WHERE s.status = 'on_leave')::int AS "onLeave"
           FROM staff s WHERE ${where}`,
        [campusIds],
      ),
      ds.query(
        `SELECT s.staff_type::text AS k, count(*)::int AS n FROM staff s
          WHERE ${where} AND s.status IN ('active', 'on_leave') GROUP BY 1`,
        [campusIds],
      ),
      this.byCampus('staff', `s.status IN ('active', 'on_leave')`, campusIds),
    ]);
    return { ...head, byType: { ...zeros(Object.values(StaffKind)), ...this.toMap(types) }, byCampus };
  }

  /** table and currentSql are internal literals, never user input. */
  private byCampus(table: 'students' | 'staff', currentSql: string, campusIds: CampusFilter) {
    return this.ctx.dataSource.query(
      `SELECT s.campus_id AS "campusId", c.code, c.name,
              count(*) FILTER (WHERE ${currentSql})::int AS current, count(*)::int AS total
         FROM ${table} s LEFT JOIN campuses c ON c.id = s.campus_id
        WHERE s.deleted_at IS NULL AND ($1::uuid[] IS NULL OR s.campus_id = ANY($1::uuid[]))
        GROUP BY s.campus_id, c.code, c.name
        ORDER BY c.name NULLS LAST`,
      [campusIds],
    );
  }

  private toMap(rows: { k: string; n: number }[]) {
    return Object.fromEntries(rows.map((r) => [r.k, r.n]));
  }
}
