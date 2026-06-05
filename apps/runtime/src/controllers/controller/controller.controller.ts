import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { ControllerWrite, NewController } from '@weber-nexus/repository';
import { ControllersService } from './controller.service';

@Controller('controllers')
export class ControllersController {
  constructor(private service: ControllersService) {}

  @Get()
  findAll() {
    return this.service.getAllControllers();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.getControllerById(Number(id));
  }

  @Post()
  create(@Body() controller: NewController) {
    return this.service.postController(controller);
  }

  @Patch()
  update(@Body() controller: ControllerWrite) {
    return this.service.updateController(controller);
  }

  @Delete(':id')
  delete(@Param('id') controllerId: string) {
    return this.service.deleteController(Number(controllerId));
  }
}
