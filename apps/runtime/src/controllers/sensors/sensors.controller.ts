import { Controller, Get, Param } from '@nestjs/common';
import { SensorsService } from './sensors.service';

@Controller('sensors')
export class SensorsController {
  constructor(private service: SensorsService) {}

  @Get()
  findAll() {
    return this.service.getAllSensors();
  }

  @Get()
  findById(@Param('id') id: number) {
    return this.service.getSensorById(id);
  }
}
