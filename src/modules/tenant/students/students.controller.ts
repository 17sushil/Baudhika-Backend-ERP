import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiBodyExamples } from '../../../common/swagger/api-examples.decorator';
import { ApiEnvelope, ApiErrors, ApiNoContent } from '../../../common/swagger/api-response.decorators';
import { RequireAccess } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import {
  ChangeStudentStatusDto,
  CreateStudentDto,
  LinkGuardianDto,
  ListStudentsDto,
  StudentHealthDto,
  UpdateGuardianLinkDto,
  UpdateStudentDto,
} from './dto/student.dto';
import {
  StudentDetailDto,
  StudentGuardianLinkDto,
  StudentHealthViewDto,
  StudentPageDto,
  StudentStatusHistoryDto,
} from './dto/student.response.dto';
import { StudentsService } from './students.service';

const SCOPE = 'Branch-scoped users only reach students of their campuses.';

@ApiTags('Students')
@ApiTenantAuth()
@Controller('students')
@UseGuards(TenantAuthGuard)
export class StudentsController {
  constructor(private students: StudentsService) {}

  @Get()
  @RequireAccess('student.read')
  @ApiOperation({ summary: 'List students', description: `Needs student.read. search = name contains, or exact admission no / EMIS id. ${SCOPE}` })
  @ApiEnvelope(StudentPageDto)
  list(@Query() q: ListStudentsDto, @Req() req: TenantRequest) {
    return this.students.list(q, req.auth);
  }

  @Get(':id')
  @RequireAccess('student.read')
  @ApiOperation({ summary: 'Get a student with person details and guardians', description: `Needs student.read. ${SCOPE}` })
  @ApiEnvelope(StudentDetailDto)
  @ApiErrors({ 404: 'Student not found' })
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.students.get(id, req.auth);
  }

  @ApiBodyExamples(CreateStudentDto, {
    newPerson: {
      summary: 'New student (creates the person)',
      value: {
        campusId: '<campus id from GET /campuses>',
        admissionDate: '2026-04-14',
        person: { firstName: 'Ram', lastName: 'Sharma', gender: 'male', dob: '2015-04-14', contacts: [{ type: 'phone', value: '9861234567', isPrimary: true }] },
      },
    },
    existingPerson: { summary: 'Existing person (personId)', value: { personId: '<person id>', campusId: '<campus id from GET /campuses>', admissionDate: '2026-04-14' } },
    transferIn: {
      summary: 'Transfer from another school',
      value: {
        campusId: '<campus id from GET /campuses>', admissionDate: '2026-04-14', admissionType: 'transfer_in', previousSchoolName: 'Everest English School', previousTcNo: 'TC-2026-118',
        person: { firstName: 'Sita', gender: 'female', dob: '2014-09-01' },
      },
    },
  })
  @Post()
  @RequireAccess('student.create')
  @ApiOperation({
    summary: 'Admit a student',
    description:
      'Needs student.create (+ person.create for an inline person). The person needs first name, dob and gender. ' +
      'admission_no is generated (e.g. ADM-2026-00031). Starts as applicant: link a primary guardian, then POST /:id/status { status: active }.',
  })
  @ApiEnvelope(StudentDetailDto, { status: 201 })
  @ApiErrors({
    400: 'Validation failed; campus not found/inactive; transfer_in without previous school/TC; person incomplete',
    403: 'No access to this campus',
    409: 'Person already a student, or EMIS id in use',
  })
  create(@Body() dto: CreateStudentDto, @Req() req: TenantRequest) {
    return this.students.create(dto, req.auth);
  }

  @Patch(':id')
  @RequireAccess('student.update')
  @ApiOperation({ summary: 'Update admission details', description: `Needs student.update. Status and admission number have their own rules. ${SCOPE}` })
  @ApiEnvelope(StudentDetailDto)
  @ApiErrors({ 400: 'Validation failed', 403: 'No access to the target campus', 404: 'Student not found', 409: 'EMIS id in use' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto, @Req() req: TenantRequest) {
    return this.students.update(id, dto, req.auth);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequireAccess('student.update')
  @ApiOperation({
    summary: 'Change status (activate, suspend, exit, readmit)',
    description: 'active needs a current primary guardian. alumni/transferred_out/dropped need leavingDate. Every change is written to the status history.',
  })
  @ApiEnvelope(StudentDetailDto)
  @ApiErrors({ 400: 'Same status, missing leavingDate, or no primary guardian', 404: 'Student not found', 409: 'Changed concurrently' })
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStudentStatusDto, @Req() req: TenantRequest) {
    return this.students.changeStatus(id, dto, req.auth);
  }

  @Get(':id/status-history')
  @RequireAccess('student.read')
  @ApiOperation({ summary: 'Status timeline (append-only)' })
  @ApiEnvelope(StudentStatusHistoryDto, { isArray: true })
  @ApiErrors({ 404: 'Student not found' })
  statusHistory(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.students.statusHistory(id, req.auth);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireAccess('student.delete')
  @ApiOperation({ summary: 'Remove an applicant entered by mistake', description: 'Soft delete. Admitted students leave via a status change instead.' })
  @ApiNoContent('Removed')
  @ApiErrors({ 404: 'Student not found', 409: 'Not an applicant' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.students.remove(id, req.auth);
  }

  // ---- health
  @Get(':id/health')
  @RequireAccess('student.health.read')
  @ApiOperation({ summary: 'Health and disability record (sensitive)', description: 'Needs student.health.read. Every read is written to audit_logs.' })
  @ApiEnvelope(StudentHealthViewDto)
  @ApiErrors({ 404: 'Student not found' })
  getHealth(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.students.getHealth(id, req.auth);
  }

  @Put(':id/health')
  @RequireAccess('student.health.update')
  @ApiOperation({ summary: 'Replace the health record', description: 'Needs student.health.update. PUT: omitted fields are cleared.' })
  @ApiEnvelope(StudentHealthViewDto)
  @ApiErrors({ 400: 'Validation failed', 404: 'Student not found' })
  putHealth(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StudentHealthDto, @Req() req: TenantRequest) {
    return this.students.putHealth(id, dto, req.auth);
  }

  // ---- guardians
  @Get(':id/guardians')
  @RequireAccess('student.read')
  @ApiOperation({ summary: "Student's guardians and their permissions" })
  @ApiEnvelope(StudentGuardianLinkDto, { isArray: true })
  @ApiErrors({ 404: 'Student not found' })
  listGuardians(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.students.listGuardians(id, req.auth);
  }

  @ApiBodyExamples(LinkGuardianDto, {
    newGuardian: {
      summary: 'Create the guardian inline',
      value: { relation: 'mother', isPrimary: true, guardian: { person: { firstName: 'Sita', lastName: 'Sharma', contacts: [{ type: 'phone', value: '9851111111', isPrimary: true }] }, occupation: 'Teacher' } },
    },
    existingGuardian: { summary: 'Link an existing guardian (guardianId)', value: { guardianId: '<guardian id>', relation: 'father', canPickup: true } },
  })
  @Post(':id/guardians')
  @RequireAccess('student.update')
  @ApiOperation({
    summary: 'Link a guardian',
    description: 'Existing guardianId, or create one inline (needs guardian.create). isPrimary demotes the current primary. Returns all links.',
  })
  @ApiEnvelope(StudentGuardianLinkDto, { status: 201, isArray: true })
  @ApiErrors({ 400: 'Not exactly one of guardianId/guardian, guardian not found, or self-link', 404: 'Student not found', 409: 'Already linked' })
  addGuardian(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkGuardianDto, @Req() req: TenantRequest) {
    return this.students.addGuardian(id, dto, req.auth);
  }

  @Patch(':id/guardians/:guardianId')
  @RequireAccess('student.update')
  @ApiOperation({ summary: 'Change relation, permissions or validity of a link', description: 'Set validTo to end portal/pickup access without deleting history.' })
  @ApiEnvelope(StudentGuardianLinkDto, { isArray: true })
  @ApiErrors({ 400: 'Validation failed', 404: 'Not linked', 409: 'Would leave an active student without a primary guardian' })
  updateGuardianLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
    @Body() dto: UpdateGuardianLinkDto,
    @Req() req: TenantRequest,
  ) {
    return this.students.updateGuardianLink(id, guardianId, dto, req.auth);
  }

  @Delete(':id/guardians/:guardianId')
  @HttpCode(204)
  @RequireAccess('student.update')
  @ApiOperation({ summary: 'Unlink a guardian', description: 'The link snapshot stays in audit_logs.' })
  @ApiNoContent('Unlinked')
  @ApiErrors({ 404: 'Not linked', 409: 'Would leave an active student without a primary guardian' })
  removeGuardian(@Param('id', ParseUUIDPipe) id: string, @Param('guardianId', ParseUUIDPipe) guardianId: string, @Req() req: TenantRequest) {
    return this.students.removeGuardian(id, guardianId, req.auth);
  }
}
