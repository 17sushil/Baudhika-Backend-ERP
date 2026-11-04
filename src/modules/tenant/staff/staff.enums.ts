export enum StaffKind {
  TEACHING = 'teaching',
  NON_TEACHING = 'non_teaching',
  ADMIN = 'admin',
  DRIVER = 'driver',
  SUPPORT = 'support',
  MANAGEMENT = 'management',
}

export enum EmploymentKind {
  PERMANENT = 'permanent',
  CONTRACT = 'contract',
  VISITING = 'visiting',
  PART_TIME = 'part_time',
}

export enum StaffStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  RESIGNED = 'resigned',
  TERMINATED = 'terminated',
  RETIRED = 'retired',
}

/** Statuses that mean the employee left; they require leaving_date. */
export const STAFF_EXIT_STATUSES: ReadonlySet<StaffStatus> = new Set([
  StaffStatus.RESIGNED,
  StaffStatus.TERMINATED,
  StaffStatus.RETIRED,
]);
