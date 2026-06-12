import { Body, Controller, Post } from '@nestjs/common';
import { parseLoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: unknown) {
    const dto = parseLoginDto(body);

    return this.authService.login(dto.email, dto.password);
  }
}
