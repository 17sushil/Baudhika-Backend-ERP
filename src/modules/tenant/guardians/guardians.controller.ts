import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiBodyExamples } from '../../../common/swagger/api-examples.decorator';
import { ApiEnvelope, ApiErrors, ApiNoContent } from '../../../common/swagger/api-response.decorators';
import { RequireAccess } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { CreateGuardianDto, ListGuardiansDto, UpdateGuardianDto } from './dto/guardian.dto';
import { GuardianDetailDto, GuardianPageDto } from './dto/guardian.response.dto';
import { GuardiansService } from './guardians.service';

const SCOPE = 'Branch-scoped users see guardians of students on their campuses (and unlinked ones).';

@ApiTags('Guardians')
@ApiTenantAuth()
@Controller('guardians')
@UseGuards(TenantAuthGuard)
export class GuardiansController {
  constructor(private guardians: GuardiansService) {}

  @Get()
  @RequireAccess('guardian.read')
  @ApiOperation({ summary: 'List guardians', description: `Needs guardian.read. search = name contains, or exact phone/email. ${SCOPE}` })
  @ApiEnvelope(GuardianPageDto)
  list(@Query() q: ListGuardiansDto, @Req() req: TenantRequest) {
    return this.guardians.list(q, req.auth);
  }

  @Get(':id')
  @RequireAccess('guardian.read')
  @ApiOperation({ summary: 'Get a guardian with person details and children', description: `Needs guardian.read. ${SCOPE}` })
  @ApiEnvelope(GuardianDetailDto)
  @ApiErrors({ 404: 'Guardian not found' })
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.guardians.get(id, req.auth);
  }

  @ApiBodyExamples(CreateGuardianDto, {
    newPerson: { summary: 'New person', value: { person: { firstName: 'Hari', lastName: 'Sharma', contacts: [{ type: 'phone', value: '9841000000', isPrimary: true }] }, occupation: 'Engineer' } },
    existingPerson: { summary: 'Existing person, e.g. a teacher (personId from /persons/lookup)', value: { personId: '<person id>', occupation: 'Teacher' } },
  })
  @Post()
  @RequireAccess('guardian.create')
  @ApiOperation({
    summary: 'Create a guardian',
    description: 'Needs guardian.create (+ person.create for an inline person). annualIncome needs guardian.sensitive.read. Link to a student via POST /students/:id/guardians.',
  })
  @ApiEnvelope(GuardianDetailDto, { status: 201 })
  @ApiErrors({ 400: 'Validation failed, or not exactly one of personId/person', 403: 'Sensitive field without permission', 409: 'Person already has a guardian profile' })
  create(@Body() dto: CreateGuardianDto, @Req() req: TenantRequest) {
    return this.guardians.create(dto, req.auth);
  }

  @Patch(':id')
  @RequireAccess('guardian.update')
  @ApiOperation({ summary: 'Update guardian details', description: `Needs guardian.update. Name/contacts are edited on /persons/:personId. ${SCOPE}` })
  @ApiEnvelope(GuardianDetailDto)
  @ApiErrors({ 400: 'Validation failed', 403: 'Sensitive field without permission', 404: 'Guardian not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGuardianDto, @Req() req: TenantRequest) {
    return this.guardians.update(id, dto, req.auth);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireAccess('guardian.delete')
  @ApiOperation({ summary: 'Remove a guardian with no linked students', description: 'Soft delete; the person record stays.' })
  @ApiNoContent('Removed')
  @ApiErrors({ 404: 'Guardian not found', 409: 'Guardian still linked to students' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.guardians.remove(id, req.auth);
  }
}
