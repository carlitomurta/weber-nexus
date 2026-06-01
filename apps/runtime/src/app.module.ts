import { Module } from '@nestjs/common';
import { ControllerModule } from './controllers/controller.module';

@Module({
  imports: [ControllerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
