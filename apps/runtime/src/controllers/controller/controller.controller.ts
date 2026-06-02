import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { Controller as ControllerType } from '@weber-nexus/repository';
import { ControllersService } from './controller.service';

@Controller('controllers')
export class ControllersController {
  constructor(private service: ControllersService) {}

  @Get()
  findAll() {
    return this.service.getAllControllers();
  }

  @Get()
  findById(@Param('id') id: number) {
    return this.service.getControllerById(id);
  }

  @Post()
  create(@Body() controller: Omit<ControllerType, 'id'>) {
    return this.service.postController(controller);
  }

  @Patch()
  update(@Body() controller: ControllerType) {
    return this.service.updateController(controller);
  }

  @Delete()
  delete(@Param('id') controllerId: number) {
    return this.service.deleteController(controllerId);
  }
}
