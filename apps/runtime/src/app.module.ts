import { Module } from '@nestjs/common';
import { ControllerModule } from './controllers/controller.module';
import { DatabaseModule } from './core/database.module';

@Module({
  imports: [DatabaseModule, ControllerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
