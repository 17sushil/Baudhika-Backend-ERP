import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiEnvelope, ApiErrors } from '../../../common/swagger/api-response.decorators';
import { RequirePermissions } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
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
}
