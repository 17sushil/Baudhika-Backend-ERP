import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

/** School admin user management. Needs x-tenant-id and a tenant access token. */
@Controller('users')
@UseGuards(TenantAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Post()
  @RequirePermissions('user.create')
  create(@Body() dto: CreateUserDto, @Req() req: TenantRequest) {
    return this.users.create(dto, req.auth);
  }

  @Get()
  @RequirePermissions('user.read')
  list(@Query() q: ListUsersDto) {
    return this.users.list(q);
  }

  @Get(':id')
  @RequirePermissions('user.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Patch(':id/status')
  @RequirePermissions('user.update')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserStatusDto, @Req() req: TenantRequest) {
    return this.users.setStatus(id, dto.status, req.auth);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermissions('user.update')
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetPasswordDto, @Req() req: TenantRequest) {
    return this.users.resetPassword(id, dto, req.auth);
  }
}
