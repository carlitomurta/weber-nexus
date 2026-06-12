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
import { parseCreateSensorDto, parseUpdateSensorDto } from './dto/sensor.dto';
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
  create(@Body() sensor: unknown) {
    return this.service.postSensor(parseCreateSensorDto(sensor));
  }

  @Patch()
  update(@Body() sensor: unknown) {
    return this.service.updateSensor(parseUpdateSensorDto(sensor));
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) sensorId: number) {
    return this.service.deleteSensor(sensorId);
  }
}
