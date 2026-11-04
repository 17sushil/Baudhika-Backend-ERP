import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiEnvelope, ApiErrors, ApiNoContent } from '../../../common/swagger/api-response.decorators';
import { RequirePermissions } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { PermissionDto, RoleDto } from './dto/role.response.dto';
import { RolesService } from './roles.service';

const HIERARCHY = 'You can only manage roles whose permissions you all hold yourself (the principal, holding everything, is at the top).';

@ApiTags('Roles')
@ApiTenantAuth()
@Controller()
@UseGuards(TenantAuthGuard)
export class RolesController {
  constructor(private roles: RolesService) {}

  @Get('permissions')
  @RequirePermissions('role.read')
  @ApiOperation({ summary: 'Permission catalogue', description: 'Every permission a role can grant. Needs role.read.' })
  @ApiEnvelope(PermissionDto, { isArray: true })
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Get('roles')
  @RequirePermissions('role.read')
  @ApiOperation({ summary: 'List roles with their permissions', description: `Needs role.read. Broadest roles first. manageable tells whether you may edit/assign each role. ${HIERARCHY}` })
  @ApiEnvelope(RoleDto, { isArray: true })
  list(@Req() req: TenantRequest) {
    return this.roles.list(req.auth);
  }

  @Get('roles/:id')
  @RequirePermissions('role.read')
  @ApiOperation({ summary: 'Get a role', description: 'Needs role.read.' })
  @ApiEnvelope(RoleDto)
  @ApiErrors({ 404: 'Role not found' })
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.roles.get(id, req.auth);
  }

  @Post('roles')
  @RequirePermissions('role.manage')
  @ApiOperation({ summary: 'Create a custom role', description: `Needs role.manage. ${HIERARCHY}` })
  @ApiEnvelope(RoleDto, { status: 201 })
  @ApiErrors({ 400: 'Validation failed or unknown permission', 403: 'Includes permissions you do not hold', 409: 'Code already exists' })
  create(@Body() dto: CreateRoleDto, @Req() req: TenantRequest) {
    return this.roles.create(dto, req.auth);
  }

  @Patch('roles/:id')
  @RequirePermissions('role.manage')
  @ApiOperation({
    summary: 'Rename a role, toggle OTP or replace its permissions',
    description: `Needs role.manage. Changes apply immediately to every holder. The principal role only accepts a new name. ${HIERARCHY}`,
  })
  @ApiEnvelope(RoleDto)
  @ApiErrors({ 400: 'Validation failed, unknown permission, or principal permissions/OTP change', 403: 'Role above your level', 404: 'Role not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto, @Req() req: TenantRequest) {
    return this.roles.update(id, dto, req.auth);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  @RequirePermissions('role.manage')
  @ApiOperation({ summary: 'Delete a custom role', description: 'Needs role.manage. Built-in roles cannot be deleted; assignments must be revoked first.' })
  @ApiNoContent('Deleted')
  @ApiErrors({ 400: 'Built-in role', 403: 'Role above your level', 404: 'Role not found', 409: 'Role still assigned' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.roles.remove(id, req.auth);
  }
}
