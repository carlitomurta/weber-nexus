import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseIntPipe,
} from '@nestjs/common';
import type { NewSensor, SensorWrite } from '@weber-nexus/repository';
import { SensorsService } from './sensors.service';

@Controller('sensors')
export class SensorsController {
  constructor(private readonly service: SensorsService) {}

  @Get()
  findAll() {
    return this.service.getAllSensors();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSensorById(id);
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
  delete(@Param('id', ParseIntPipe) sensorId: number) {
    return this.service.deleteSensor(sensorId);
  }
}
