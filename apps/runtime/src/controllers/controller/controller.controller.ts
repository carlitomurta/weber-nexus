import { Controller, Get, Param } from '@nestjs/common';
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
}
