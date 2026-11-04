import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiTenantAuth } from '../../../common/swagger/api-auth.decorators';
import { ApiEnvelope } from '../../../common/swagger/api-response.decorators';
import { RequireAnyAccess } from '../access/access.decorators';
import type { TenantRequest } from '../auth/auth.types';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { DashboardService } from './dashboard.service';
import { KpiQueryDto, KpisDto } from './dto/kpi.dto';

@ApiTags('Dashboard')
@ApiTenantAuth()
@Controller('dashboard')
@UseGuards(TenantAuthGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('kpis')
  @RequireAnyAccess('student.read', 'staff.read')
  @ApiOperation({
    summary: 'KPIs: total students and total staff',
    description:
      'students (needs student.read): enrolled = status active (the headline number), applicants, total records, by status, by gender, by campus, ' +
      'admissions this month/year. staff (needs staff.read): current = active + on leave (the headline number), by type, by campus. ' +
      'Each block appears only with its permission; branch-scoped users get their campuses only; campusId narrows to one campus.',
  })
  @ApiEnvelope(KpisDto)
  kpis(@Query() q: KpiQueryDto, @Req() req: TenantRequest) {
    return this.dashboard.kpis(q, req.auth);
  }
}
