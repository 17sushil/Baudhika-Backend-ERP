import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiBodyExamples } from '../../../common/swagger/api-examples.decorator';
import { ApiEnvelope, ApiErrors, ApiNoContent } from '../../../common/swagger/api-response.decorators';
import { RequireAccess } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import {
  ChangeStaffStatusDto,
  CreateStaffDto,
  DriverProfileDto,
  ListStaffDto,
  QualificationDto,
  TeacherProfileDto,
  UpdateQualificationDto,
  UpdateStaffDto,
} from './dto/staff.dto';
import { QualificationViewDto, StaffDetailDto, StaffPageDto } from './dto/staff.response.dto';
import { StaffService } from './staff.service';

const SCOPE = 'Branch-scoped users only reach staff of their campuses.';

@ApiTags('Staff')
@ApiTenantAuth()
@Controller('staff')
@UseGuards(TenantAuthGuard)
export class StaffController {
  constructor(private staff: StaffService) {}

  @Get()
  @RequireAccess('staff.read')
  @ApiOperation({ summary: 'List staff', description: `Needs staff.read. search = name contains, or exact employee code. ${SCOPE}` })
  @ApiEnvelope(StaffPageDto)
  list(@Query() q: ListStaffDto, @Req() req: TenantRequest) {
    return this.staff.list(q, req.auth);
  }

  @Get(':id')
  @RequireAccess('staff.read')
  @ApiOperation({ summary: 'Get a staff member with person, profiles and qualifications', description: `Needs staff.read. ${SCOPE}` })
  @ApiEnvelope(StaffDetailDto)
  @ApiErrors({ 404: 'Staff not found' })
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.staff.get(id, req.auth);
  }

  @ApiBodyExamples(CreateStaffDto, {
    teacher: {
      summary: 'Teacher (teacherProfile required)',
      value: {
        campusId: '<campus id from GET /campuses>', staffType: 'teaching', employmentType: 'permanent', joiningDate: '2026-04-01',
        teacherProfile: { specialization: 'Mathematics', experienceYears: 6.5 },
        person: { firstName: 'Gita', lastName: 'Rai', gender: 'female', contacts: [{ type: 'email', value: 'gita@sunrise.edu', isPrimary: true }] },
      },
    },
    driver: {
      summary: 'Driver (driverProfile with unexpired licence)',
      value: { campusId: '<campus id from GET /campuses>', staffType: 'driver', joiningDate: '2026-04-01', driverProfile: { licenseNo: '01-06-12345678', licenseExpiry: '2030-01-01' }, person: { firstName: 'Bir', lastName: 'Gurung' } },
    },
    existingPerson: { summary: 'Existing person (personId)', value: { personId: '<person id>', campusId: '<campus id from GET /campuses>', staffType: 'admin', joiningDate: '2026-04-01' } },
  })
  @Post()
  @RequireAccess('staff.create')
  @ApiOperation({
    summary: 'Onboard a staff member',
    description:
      'Needs staff.create (+ person.create for an inline person). employee_code is generated. ' +
      'teaching needs teacherProfile; driver needs driverProfile with an unexpired licence.',
  })
  @ApiEnvelope(StaffDetailDto, { status: 201 })
  @ApiErrors({
    400: 'Validation failed; missing/mismatched profile; campus/department/designation invalid; department on another campus',
    403: 'No access to this campus',
    409: 'Person already a staff member',
  })
  create(@Body() dto: CreateStaffDto, @Req() req: TenantRequest) {
    return this.staff.create(dto, req.auth);
  }

  @Patch(':id')
  @RequireAccess('staff.update')
  @ApiOperation({ summary: 'Update employment details', description: `Needs staff.update. Changing staffType needs the matching profile. ${SCOPE}` })
  @ApiEnvelope(StaffDetailDto)
  @ApiErrors({ 400: 'Validation failed, invalid manager (self/cycle) or placement', 403: 'No access to the target campus', 404: 'Staff not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto, @Req() req: TenantRequest) {
    return this.staff.update(id, dto, req.auth);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequireAccess('staff.update')
  @ApiOperation({ summary: 'Change employment status', description: 'resigned/terminated/retired need leavingDate; returning to active clears it.' })
  @ApiEnvelope(StaffDetailDto)
  @ApiErrors({ 400: 'Same status or missing leavingDate', 404: 'Staff not found' })
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStaffStatusDto, @Req() req: TenantRequest) {
    return this.staff.changeStatus(id, dto, req.auth);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireAccess('staff.delete')
  @ApiOperation({ summary: 'Remove a staff record entered by mistake', description: 'Soft delete. Departures use a status change instead.' })
  @ApiNoContent('Removed')
  @ApiErrors({ 404: 'Staff not found', 409: 'Others report to this person' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.staff.remove(id, req.auth);
  }

  @Put(':id/teacher-profile')
  @RequireAccess('staff.update')
  @ApiOperation({ summary: 'Create or update the teacher profile', description: 'Teaching staff only.' })
  @ApiEnvelope(StaffDetailDto)
  @ApiErrors({ 400: 'Not teaching staff', 404: 'Staff not found' })
  putTeacherProfile(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TeacherProfileDto, @Req() req: TenantRequest) {
    return this.staff.putTeacherProfile(id, dto, req.auth);
  }

  @Put(':id/driver-profile')
  @RequireAccess('staff.update')
  @ApiOperation({ summary: 'Create or update the driver profile', description: 'Drivers only; licence must not be expired.' })
  @ApiEnvelope(StaffDetailDto)
  @ApiErrors({ 400: 'Not a driver, or licence expired', 404: 'Staff not found' })
  putDriverProfile(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DriverProfileDto, @Req() req: TenantRequest) {
    return this.staff.putDriverProfile(id, dto, req.auth);
  }

  @Post(':id/qualifications')
  @RequireAccess('staff.update')
  @ApiOperation({ summary: 'Add a qualification' })
  @ApiEnvelope(QualificationViewDto, { status: 201 })
  @ApiErrors({ 400: 'Validation failed', 404: 'Staff not found' })
  addQualification(@Param('id', ParseUUIDPipe) id: string, @Body() dto: QualificationDto, @Req() req: TenantRequest) {
    return this.staff.addQualification(id, dto, req.auth);
  }

  @Patch(':id/qualifications/:qualificationId')
  @RequireAccess('staff.update')
  @ApiOperation({ summary: 'Update a qualification' })
  @ApiEnvelope(QualificationViewDto)
  @ApiErrors({ 400: 'Validation failed', 404: 'Staff or qualification not found' })
  updateQualification(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('qualificationId', ParseUUIDPipe) qualificationId: string,
    @Body() dto: UpdateQualificationDto,
    @Req() req: TenantRequest,
  ) {
    return this.staff.updateQualification(id, qualificationId, dto, req.auth);
  }

  @Delete(':id/qualifications/:qualificationId')
  @HttpCode(204)
  @RequireAccess('staff.update')
  @ApiOperation({ summary: 'Remove a qualification' })
  @ApiNoContent('Removed')
  @ApiErrors({ 404: 'Staff or qualification not found' })
  removeQualification(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('qualificationId', ParseUUIDPipe) qualificationId: string,
    @Req() req: TenantRequest,
  ) {
    return this.staff.removeQualification(id, qualificationId, req.auth);
  }
}
