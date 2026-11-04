import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiEnvelope } from '../../../common/swagger/api-response.decorators';
import { RequirePermissions } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { AuditService } from './audit.service';
import { AuditLogPageDto } from './dto/audit-log.response.dto';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@ApiTags('Audit')
@ApiTenantAuth()
@Controller('audit-logs')
@UseGuards(TenantAuthGuard)
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Search the audit trail (newest first)', description: 'Needs audit.read (institution-wide). Health snapshots, religion/ethnicity and guardian income are redacted unless you also hold their permissions.' })
  @ApiEnvelope(AuditLogPageDto)
  list(@Query() q: ListAuditLogsDto, @Req() req: TenantRequest) {
    return this.audit.list(q, req.auth);
  }
}
