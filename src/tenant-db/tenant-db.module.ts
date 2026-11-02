import { Global, Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { TenantConnectionService } from './tenant-connection.service';

export const TENANT_DS = 'TENANT_DS';

@Global()
@Module({
  providers: [
    TenantConnectionService,
    {
      provide: TENANT_DS,
      scope: Scope.REQUEST,
      inject: [REQUEST, TenantConnectionService],
      useFactory: (req: any, conn: TenantConnectionService) =>
        conn.get(req.tenant.dbName),
    },
  ],
  exports: [TenantConnectionService, TENANT_DS],
})
export class TenantDbModule {}