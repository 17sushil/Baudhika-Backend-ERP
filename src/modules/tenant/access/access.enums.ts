/** Postgres enum user_status. Suspended is temporary; disabled is permanent. */
export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DISABLED = 'disabled',
}

/** Postgres enum scope_kind: the level a role assignment applies to. */
export enum ScopeKind {
  INSTITUTION = 'institution',
  CAMPUS = 'campus',
  DEPARTMENT = 'department',
  CLASS = 'class',
  SECTION = 'section',
}
