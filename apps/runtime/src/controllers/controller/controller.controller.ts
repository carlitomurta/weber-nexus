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
import {
  parseCreateControllerDto,
  parseUpdateControllerDto,
} from './dto/controller.dto';
import { ControllersService } from './controller.service';

@Controller('controllers')
export class ControllersController {
  constructor(private readonly service: ControllersService) {}

  @Get()
  findAll() {
    return this.service.getAllControllers();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getControllerById(id);
  }

  @Post()
  create(@Body() controller: unknown) {
    return this.service.postController(parseCreateControllerDto(controller));
  }

  @Post(':id/xml/sync')
  syncXml(@Param('id', ParseIntPipe) id: number) {
    return this.service.syncControllerXml(id);
  }

  @Patch()
  update(@Body() controller: unknown) {
    return this.service.updateController(parseUpdateControllerDto(controller));
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) controllerId: number) {
    return this.service.deleteController(controllerId);
  }
}
