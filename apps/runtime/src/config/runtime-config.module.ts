import { Global, Module } from '@nestjs/common';
import { RuntimeEnvService } from './runtime-env.service';

@Global()
@Module({
  providers: [RuntimeEnvService],
  exports: [RuntimeEnvService],
})
export class RuntimeConfigModule {}
