import { ApiProperty } from '@nestjs/swagger';

export class PermissionDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'student.read' }) code: string;
  @ApiProperty({ type: String, nullable: true, example: 'View students, their guardians and status history' }) description: string | null;
}

export class RoleDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'principal' }) code: string;
  @ApiProperty({ example: 'Principal' }) name: string;
  /** Built-in role: cannot be deleted; its code never changes. */
  isSystem: boolean;
  requiresMfa: boolean;
  @ApiProperty({ type: [String], example: ['org.read', 'student.read'] }) permissions: string[];
  /** Users currently holding this role (any scope, inside validity dates). */
  @ApiProperty({ example: 3 }) userCount: number;
  /** Whether the caller may edit, assign or delete this role (its permissions are a subset of the caller's). */
  manageable: boolean;
  createdAt: Date;
  updatedAt: Date;
}
