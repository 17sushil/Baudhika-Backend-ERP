/** Postgres enum audit_action. 'read' logs access to sensitive data (health records). */
export enum AuditAction {
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
  READ = 'read',
}
