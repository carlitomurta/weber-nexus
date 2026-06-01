import { Controller, Get } from '@nestjs/common';

@Controller('controllers')
export class ControllersController {
  @Get()
  findAll(): string {
    return 'This action returns all controllers';
  }
}
