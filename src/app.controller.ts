import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AppInfoDto, HealthDto } from './app.response.dto';
import { ApiEnvelope, ApiErrors } from './common/swagger/api-response.decorators';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Service info' })
  @ApiEnvelope(AppInfoDto)
  getInfo() {
    return this.appService.getInfo();
  }

  @Get('health')
  @ApiOperation({ summary: 'Liveness + master database check' })
  @ApiEnvelope(HealthDto)
  @ApiErrors({ 503: 'Master database unreachable: body { status: "error", database: "down" } (not wrapped)' })
  getHealth() {
    return this.appService.getHealth();
  }
}
