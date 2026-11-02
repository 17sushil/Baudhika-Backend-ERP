import { Global, Module } from '@nestjs/common';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantContext } from './tenant-context';

/** Infrastructure only (no master-DB dependencies), so control-plane modules can use it too. */
@Global()
@Module({
  providers: [TenantConnectionService, TenantContext],
  exports: [TenantConnectionService, TenantContext],
})
export class TenantDbModule {}
