import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { NewSensor, SensorWrite } from '@weber-nexus/repository';
import { SensorsService } from './sensors.service';

@Controller('sensors')
export class SensorsController {
  constructor(private service: SensorsService) {}

  @Get()
  findAll() {
    return this.service.getAllSensors();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.getSensorById(Number(id));
  }

  @Post()
  create(@Body() sensor: NewSensor) {
    return this.service.postSensor(sensor);
  }

  @Patch()
  update(@Body() sensor: SensorWrite) {
    return this.service.updateSensor(sensor);
  }

  @Delete(':id')
  delete(@Param('id') sensorId: string) {
    return this.service.deleteSensor(Number(sensorId));
  }
}
