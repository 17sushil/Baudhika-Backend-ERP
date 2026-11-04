import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiEnvelope, ApiErrors, ApiNoContent } from '../../../common/swagger/api-response.decorators';
import { RequireAccess, RequirePermissions } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { CreateCampusDto, ListCampusesDto, UpdateCampusDto } from './dto/campus.dto';
import {
  CreateDepartmentDto,
  CreateDesignationDto,
  ListDepartmentsDto,
  ListDesignationsDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
} from './dto/department.dto';
import { UpdateNumberSequenceDto } from './dto/number-sequence.dto';
import { CampusDto, DepartmentDto, DesignationDto, NumberSequenceDto } from './dto/organization.response.dto';
import { OrganizationService } from './organization.service';

const READ = 'Needs org.read (any scope).';
const MANAGE = 'Needs org.manage (institution-wide).';

@ApiTags('Organization')
@ApiTenantAuth()
@Controller()
@UseGuards(TenantAuthGuard)
export class OrganizationController {
  constructor(private org: OrganizationService) {}

  // ---- campuses
  @Get('campuses')
  @RequireAccess('org.read')
  @ApiOperation({ summary: 'List campuses (school and college branches)', description: READ })
  @ApiEnvelope(CampusDto, { isArray: true })
  listCampuses(@Query() q: ListCampusesDto) {
    return this.org.listCampuses(q);
  }

  @Get('campuses/:id')
  @RequireAccess('org.read')
  @ApiOperation({ summary: 'Get a campus', description: READ })
  @ApiEnvelope(CampusDto)
  @ApiErrors({ 404: 'Campus not found' })
  getCampus(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.getCampus(id);
  }

  @Post('campuses')
  @RequirePermissions('org.manage')
  @ApiOperation({ summary: 'Create a campus', description: MANAGE })
  @ApiEnvelope(CampusDto, { status: 201 })
  @ApiErrors({ 400: 'Validation failed', 409: 'Campus code already exists' })
  createCampus(@Body() dto: CreateCampusDto, @Req() req: TenantRequest) {
    return this.org.createCampus(dto, req.auth);
  }

  @Patch('campuses/:id')
  @RequirePermissions('org.manage')
  @ApiOperation({ summary: 'Update a campus', description: MANAGE })
  @ApiEnvelope(CampusDto)
  @ApiErrors({ 400: 'Validation failed', 404: 'Campus not found', 409: 'Campus code already exists' })
  updateCampus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCampusDto, @Req() req: TenantRequest) {
    return this.org.updateCampus(id, dto, req.auth);
  }

  @Delete('campuses/:id')
  @HttpCode(204)
  @RequirePermissions('org.manage')
  @ApiOperation({ summary: 'Remove an unused campus', description: `${MANAGE} Soft delete; refused while students, staff or departments use it.` })
  @ApiNoContent('Removed')
  @ApiErrors({ 404: 'Campus not found', 409: 'Campus is in use' })
  deleteCampus(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.org.deleteCampus(id, req.auth);
  }

  // ---- departments
  @Get('departments')
  @RequireAccess('org.read')
  @ApiOperation({ summary: 'List departments', description: READ })
  @ApiEnvelope(DepartmentDto, { isArray: true })
  listDepartments(@Query() q: ListDepartmentsDto) {
    return this.org.listDepartments(q);
  }

  @Get('departments/:id')
  @RequireAccess('org.read')
  @ApiOperation({ summary: 'Get a department', description: READ })
  @ApiEnvelope(DepartmentDto)
  @ApiErrors({ 404: 'Department not found' })
  getDepartment(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.getDepartment(id);
  }

  @Post('departments')
  @RequirePermissions('org.manage')
  @ApiOperation({ summary: 'Create a department', description: MANAGE })
  @ApiEnvelope(DepartmentDto, { status: 201 })
  @ApiErrors({ 400: 'Validation failed or campus not found', 409: 'Duplicate name on this campus' })
  createDepartment(@Body() dto: CreateDepartmentDto, @Req() req: TenantRequest) {
    return this.org.createDepartment(dto, req.auth);
  }

  @Patch('departments/:id')
  @RequirePermissions('org.manage')
  @ApiOperation({ summary: 'Update a department', description: MANAGE })
  @ApiEnvelope(DepartmentDto)
  @ApiErrors({ 400: 'Validation failed', 404: 'Department not found', 409: 'Duplicate name, or staff on another campus' })
  updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto, @Req() req: TenantRequest) {
    return this.org.updateDepartment(id, dto, req.auth);
  }

  @Delete('departments/:id')
  @HttpCode(204)
  @RequirePermissions('org.manage')
  @ApiOperation({ summary: 'Remove an unused department', description: `${MANAGE} Refused while staff belong to it.` })
  @ApiNoContent('Removed')
  @ApiErrors({ 404: 'Department not found', 409: 'Department has staff' })
  deleteDepartment(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.org.deleteDepartment(id, req.auth);
  }

  // ---- designations
  @Get('designations')
  @RequireAccess('org.read')
  @ApiOperation({ summary: 'List designations (job titles)', description: READ })
  @ApiEnvelope(DesignationDto, { isArray: true })
  listDesignations(@Query() q: ListDesignationsDto) {
    return this.org.listDesignations(q);
  }

  @Get('designations/:id')
  @RequireAccess('org.read')
  @ApiOperation({ summary: 'Get a designation', description: READ })
  @ApiEnvelope(DesignationDto)
  @ApiErrors({ 404: 'Designation not found' })
  getDesignation(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.getDesignation(id);
  }

  @Post('designations')
  @RequirePermissions('org.manage')
  @ApiOperation({ summary: 'Create a designation', description: MANAGE })
  @ApiEnvelope(DesignationDto, { status: 201 })
  @ApiErrors({ 400: 'Validation failed', 409: 'Designation already exists' })
  createDesignation(@Body() dto: CreateDesignationDto, @Req() req: TenantRequest) {
    return this.org.createDesignation(dto, req.auth);
  }

  @Patch('designations/:id')
  @RequirePermissions('org.manage')
  @ApiOperation({ summary: 'Update a designation', description: MANAGE })
  @ApiEnvelope(DesignationDto)
  @ApiErrors({ 400: 'Validation failed', 404: 'Designation not found', 409: 'Designation already exists' })
  updateDesignation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDesignationDto, @Req() req: TenantRequest) {
    return this.org.updateDesignation(id, dto, req.auth);
  }

  @Delete('designations/:id')
  @HttpCode(204)
  @RequirePermissions('org.manage')
  @ApiOperation({ summary: 'Remove an unused designation', description: `${MANAGE} Refused while staff use it.` })
  @ApiNoContent('Removed')
  @ApiErrors({ 404: 'Designation not found', 409: 'Designation is in use' })
  deleteDesignation(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.org.deleteDesignation(id, req.auth);
  }

  // ---- number sequences
  @Get('number-sequences')
  @RequireAccess('org.read')
  @ApiOperation({ summary: 'List code series (admission_no, employee_code)', description: READ })
  @ApiEnvelope(NumberSequenceDto, { isArray: true })
  listSequences() {
    return this.org.listSequences();
  }

  @Patch('number-sequences/:code')
  @RequirePermissions('org.manage')
  @ApiOperation({
    summary: 'Change prefix, padding or yearly reset of a series',
    description: `${MANAGE} The counter itself can never be edited (it would hand out duplicate numbers).`,
  })
  @ApiEnvelope(NumberSequenceDto)
  @ApiErrors({ 400: 'Validation failed', 404: 'Number sequence not found' })
  updateSequence(@Param('code') code: string, @Body() dto: UpdateNumberSequenceDto, @Req() req: TenantRequest) {
    return this.org.updateSequence(code, dto, req.auth);
  }
}
