import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiBodyExamples } from '../../../common/swagger/api-examples.decorator';
import { ApiEnvelope, ApiErrors, ApiNoContent } from '../../../common/swagger/api-response.decorators';
import { RequireAccess, RequirePermissions } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import {
  AddressInputDto,
  ContactInputDto,
  LinkUserDto,
  ListPersonsDto,
  LookupPersonsDto,
  PersonInputDto,
  UpdateAddressDto,
  UpdateContactDto,
  UpdatePersonDto,
} from './dto/person.dto';
import { AddressDto, ContactDto, PersonDetailDto, PersonLookupDto, PersonPageDto } from './dto/person.response.dto';
import { PersonsService } from './persons.service';

const SCOPE = 'Branch-scoped users only see people connected to their campuses.';

@ApiTags('Persons')
@ApiTenantAuth()
@Controller('persons')
@UseGuards(TenantAuthGuard)
export class PersonsController {
  constructor(private persons: PersonsService) {}

  @Get('lookup')
  @RequireAccess('person.read')
  @ApiOperation({
    summary: 'Find people by exact phone or email',
    description: 'Admission helper: reuse a parent who already exists (e.g. a teacher). Searches the whole school, returns minimal fields.',
  })
  @ApiEnvelope(PersonLookupDto, { isArray: true })
  lookup(@Query() q: LookupPersonsDto) {
    return this.persons.lookup(q.contact);
  }

  @Get()
  @RequireAccess('person.read')
  @ApiOperation({ summary: 'List people', description: `Needs person.read. ${SCOPE}` })
  @ApiEnvelope(PersonPageDto)
  list(@Query() q: ListPersonsDto, @Req() req: TenantRequest) {
    return this.persons.list(q, req.auth);
  }

  @Get(':id')
  @RequireAccess('person.read')
  @ApiOperation({ summary: 'Get a person with contacts, addresses and profiles', description: `Needs person.read. ${SCOPE}` })
  @ApiEnvelope(PersonDetailDto)
  @ApiErrors({ 404: 'Person not found' })
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: TenantRequest) {
    return this.persons.get(id, req.auth);
  }

  @ApiBodyExamples(PersonInputDto, {
    parent: {
      summary: 'Parent with phone and address',
      value: { firstName: 'Hari', lastName: 'Sharma', gender: 'male', contacts: [{ type: 'phone', value: '9841000000', isPrimary: true }], addresses: [{ type: 'current', district: 'Kathmandu' }] },
    },
  })
  @Post()
  @RequireAccess('person.create')
  @ApiOperation({ summary: 'Create a person', description: 'Needs person.create. Setting religion/ethnicity needs person.sensitive.read.' })
  @ApiEnvelope(PersonDetailDto, { status: 201 })
  @ApiErrors({ 400: 'Validation failed', 403: 'Sensitive fields without permission' })
  create(@Body() dto: PersonInputDto, @Req() req: TenantRequest) {
    return this.persons.create(dto, req.auth);
  }

  @Patch(':id')
  @RequireAccess('person.update')
  @ApiOperation({ summary: 'Update a person', description: `Needs person.update. ${SCOPE} A student must keep first name, dob and gender.` })
  @ApiEnvelope(PersonDetailDto)
  @ApiErrors({ 400: 'Validation failed', 404: 'Person not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonDto, @Req() req: TenantRequest) {
    return this.persons.update(id, dto, req.auth);
  }

  @Put(':id/user')
  @RequirePermissions('person.update', 'user.update')
  @ApiOperation({ summary: 'Link (or unlink) a login', description: 'Gives this person portal access. Needs person.update + user.update institution-wide.' })
  @ApiEnvelope(PersonDetailDto)
  @ApiErrors({ 400: 'User not found', 404: 'Person not found', 409: 'Login already belongs to another person' })
  linkUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkUserDto, @Req() req: TenantRequest) {
    return this.persons.linkUser(id, dto.userId, req.auth);
  }

  // ---- contacts
  @Post(':id/contacts')
  @RequireAccess('person.update')
  @ApiOperation({ summary: 'Add a contact', description: 'Setting isPrimary demotes the previous primary of that type.' })
  @ApiEnvelope(ContactDto, { status: 201 })
  @ApiErrors({ 400: 'Invalid phone/email', 404: 'Person not found' })
  addContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ContactInputDto, @Req() req: TenantRequest) {
    return this.persons.addContact(id, dto, req.auth);
  }

  @Patch(':id/contacts/:contactId')
  @RequireAccess('person.update')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiEnvelope(ContactDto)
  @ApiErrors({ 400: 'Invalid phone/email', 404: 'Person or contact not found' })
  updateContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
    @Req() req: TenantRequest,
  ) {
    return this.persons.updateContact(id, contactId, dto, req.auth);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(204)
  @RequireAccess('person.update')
  @ApiOperation({ summary: 'Remove a contact' })
  @ApiNoContent('Removed')
  @ApiErrors({ 404: 'Person or contact not found' })
  removeContact(@Param('id', ParseUUIDPipe) id: string, @Param('contactId', ParseUUIDPipe) contactId: string, @Req() req: TenantRequest) {
    return this.persons.removeContact(id, contactId, req.auth);
  }

  // ---- addresses
  @Post(':id/addresses')
  @RequireAccess('person.update')
  @ApiOperation({ summary: 'Add an address' })
  @ApiEnvelope(AddressDto, { status: 201 })
  @ApiErrors({ 400: 'Validation failed', 404: 'Person not found' })
  addAddress(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddressInputDto, @Req() req: TenantRequest) {
    return this.persons.addAddress(id, dto, req.auth);
  }

  @Patch(':id/addresses/:addressId')
  @RequireAccess('person.update')
  @ApiOperation({ summary: 'Update an address' })
  @ApiEnvelope(AddressDto)
  @ApiErrors({ 400: 'Validation failed', 404: 'Person or address not found' })
  updateAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
    @Req() req: TenantRequest,
  ) {
    return this.persons.updateAddress(id, addressId, dto, req.auth);
  }

  @Delete(':id/addresses/:addressId')
  @HttpCode(204)
  @RequireAccess('person.update')
  @ApiOperation({ summary: 'Remove an address' })
  @ApiNoContent('Removed')
  @ApiErrors({ 404: 'Person or address not found' })
  removeAddress(@Param('id', ParseUUIDPipe) id: string, @Param('addressId', ParseUUIDPipe) addressId: string, @Req() req: TenantRequest) {
    return this.persons.removeAddress(id, addressId, req.auth);
  }
}
