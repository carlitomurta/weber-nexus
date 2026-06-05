import { Module } from '@nestjs/common';
import { RepositoryModule } from '@weber-nexus/repository';
import { AuthModule } from './auth/auth.module';
import { ControllersModule } from './controllers/controllers.module';
import { RuntimeControlController } from './runtime-control.controller';

@Module({
  imports: [RepositoryModule, AuthModule, ControllersModule],
  controllers: [RuntimeControlController],
})
export class AppModule {}
