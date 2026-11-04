export enum AdmissionKind {
  NEW = 'new',
  TRANSFER_IN = 'transfer_in',
  READMISSION = 'readmission',
}

export enum StudentStatus {
  APPLICANT = 'applicant',
  ACTIVE = 'active',
  ALUMNI = 'alumni',
  TRANSFERRED_OUT = 'transferred_out',
  DROPPED = 'dropped',
  SUSPENDED = 'suspended',
}

/** Statuses that mean the student left; they require leaving_date. */
export const EXIT_STATUSES: ReadonlySet<StudentStatus> = new Set([
  StudentStatus.ALUMNI,
  StudentStatus.TRANSFERRED_OUT,
  StudentStatus.DROPPED,
]);

export enum GuardianRelation {
  FATHER = 'father',
  MOTHER = 'mother',
  LEGAL_GUARDIAN = 'legal_guardian',
  GRANDPARENT = 'grandparent',
  UNCLE_AUNT = 'uncle_aunt',
  OTHER = 'other',
}
