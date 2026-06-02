import { Module } from '@nestjs/common';
import { RepositoryModule } from '@weber-nexus/repository';
import { AuthModule } from './auth/auth.module';
import { ControllersModule } from './controllers/controllers.module';

@Module({
  imports: [RepositoryModule, AuthModule, ControllersModule],
})
export class AppModule {}
