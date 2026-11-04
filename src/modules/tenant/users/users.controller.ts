import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiBodyExamples } from '../../../common/swagger/api-examples.decorator';
import { ApiEnvelope, ApiErrors } from '../../../common/swagger/api-response.decorators';
import { RequirePermissions } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserListDto, UserViewDto } from './dto/user.response.dto';
import { UsersService } from './users.service';

/** School admin user management. Needs x-tenant-id and a tenant access token. */
@ApiTags('Users')
@ApiTenantAuth()
@Controller('users')
@UseGuards(TenantAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @ApiBodyExamples(CreateUserDto, {
    staffLogin: { summary: 'Staff login with email (needed for admin/principal OTP)', value: { email: 'principal@sunrise.edu', username: 'principal', password: 'Welcome2026', mustChangePassword: true, roles: ['principal'] } },
    phoneLogin: { summary: 'Login by phone, no roles yet', value: { phone: '9841000000', password: 'Welcome2026' } },
  })
  @Post()
  @RequirePermissions('user.create')
  @ApiOperation({ summary: 'Create a user', description: 'Needs user.create, plus role.assign when roles are sent. At least one of username, email, phone.' })
  @ApiEnvelope(UserViewDto, { status: 201 })
  @ApiErrors({ 400: 'Validation failed, no identifier, or unknown role', 409: 'Username, email or phone already in use' })
  create(@Body() dto: CreateUserDto, @Req() req: TenantRequest) {
    return this.users.create(dto, req.auth);
  }

  @Get()
  @RequirePermissions('user.read')
  @ApiOperation({ summary: 'List users (newest first)', description: 'Needs user.read. search matches username, email or phone.' })
  @ApiEnvelope(UserListDto)
  list(@Query() q: ListUsersDto) {
    return this.users.list(q);
  }

  @Get(':id')
  @RequirePermissions('user.read')
  @ApiOperation({ summary: 'Get a user', description: 'Needs user.read.' })
  @ApiEnvelope(UserViewDto)
  @ApiErrors({ 400: 'Malformed id', 404: 'User not found' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Patch(':id/status')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Activate, suspend or disable a user', description: 'Needs user.update. Suspending/disabling logs the user out everywhere.' })
  @ApiEnvelope(UserViewDto)
  @ApiErrors({ 400: 'Cannot change your own status', 404: 'User not found' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserStatusDto, @Req() req: TenantRequest) {
    return this.users.setStatus(id, dto.status, req.auth);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermissions('user.update')
  @ApiOperation({ summary: "Reset a user's password", description: 'Needs user.update. Clears the lockout and logs the user out everywhere.' })
  @ApiEnvelope(UserViewDto)
  @ApiErrors({ 400: 'Use change-password for your own account', 404: 'User not found' })
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetPasswordDto, @Req() req: TenantRequest) {
    return this.users.resetPassword(id, dto, req.auth);
  }

  @ApiBodyExamples(AssignRoleDto, {
    wholeSchool: { summary: 'Whole school (institution scope, no scopeId)', value: { role: 'principal' } },
    oneBranch: { summary: 'One branch only (campus scope)', value: { role: 'principal', scopeType: 'campus', scopeId: '<campus id from GET /campuses>' } },
    temporary: { summary: 'Temporary charge (ends after validTo)', value: { role: 'accountant', validFrom: '2026-04-01', validTo: '2027-03-31' } },
  })
  @Post(':id/roles')
  @HttpCode(200)
  @RequirePermissions('role.assign')
  @ApiOperation({
    summary: 'Grant a role, optionally scoped',
    description: 'Needs role.assign (institution-wide). scopeType campus limits the role to one branch. You cannot grant permissions you do not hold (so only a principal can grant principal).',
  })
  @ApiEnvelope(UserViewDto)
  @ApiErrors({ 400: 'Unknown role, bad scope, or scope target not found', 403: 'More access than you have', 404: 'User not found', 409: 'Already assigned' })
  assignRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRoleDto, @Req() req: TenantRequest) {
    return this.users.assignRole(id, dto, req.auth);
  }

  @Delete(':id/roles/:assignmentId')
  @RequirePermissions('role.assign')
  @ApiOperation({ summary: 'Revoke a role assignment', description: 'assignmentId comes from roles[].assignmentId. The last school-wide principal cannot be removed.' })
  @ApiEnvelope(UserViewDto)
  @ApiErrors({ 403: 'More access than you have', 404: 'Assignment not found', 409: 'Last school-wide principal' })
  revokeRole(@Param('id', ParseUUIDPipe) id: string, @Param('assignmentId', ParseUUIDPipe) assignmentId: string, @Req() req: TenantRequest) {
    return this.users.revokeRole(id, assignmentId, req.auth);
  }
}
