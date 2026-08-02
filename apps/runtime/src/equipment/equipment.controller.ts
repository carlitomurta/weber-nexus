import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  parseCreateEquipmentDto,
  parseCreateSensorInstallationDto,
  parseEndSensorInstallationDto,
  parseUpdateEquipmentDto,
} from './dto/equipment.dto';
import { EquipmentService } from './equipment.service';

@Controller()
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @Get('equipment-types')
  findEquipmentTypes() {
    return this.service.getEquipmentTypes();
  }

  @Get('equipment')
  findAllEquipment() {
    return this.service.getAllEquipment();
  }

  @Get('equipment/:id')
  findEquipmentById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getEquipmentById(id);
  }

  @Post('equipment')
  createEquipment(@Body() equipment: unknown) {
    return this.service.createEquipment(parseCreateEquipmentDto(equipment));
  }

  @Patch('equipment')
  updateEquipment(@Body() equipment: unknown) {
    return this.service.updateEquipment(parseUpdateEquipmentDto(equipment));
  }

  @Delete('equipment/:id')
  deleteEquipment(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteEquipment(id);
  }

  @Post('equipment/:id/sensor-installations')
  createSensorInstallation(
    @Param('id', ParseIntPipe) equipmentId: number,
    @Body() installation: unknown,
  ) {
    return this.service.createSensorInstallation(
      parseCreateSensorInstallationDto(installation, equipmentId),
    );
  }

  @Patch('sensor-installations/:id/end')
  endSensorInstallation(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.service.endSensorInstallation(
      id,
      parseEndSensorInstallationDto(body),
    );
  }

  @Patch('equipment/:id/standard-classification/confirm')
  confirmStandardClassification(@Param('id', ParseIntPipe) id: number) {
    return this.service.confirmStandardClassification(id);
  }
}
