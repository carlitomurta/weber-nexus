import { Module } from '@nestjs/common';
import { ControllerXmlConfigService } from './controller-xml-config.service';

@Module({
  providers: [ControllerXmlConfigService],
  exports: [ControllerXmlConfigService],
})
export class ControllerXmlConfigModule {}
