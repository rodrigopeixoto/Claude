import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsOptional, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';

class RegisterDto {
  @IsEmail()
  email!: string;

  @MinLength(2)
  name!: string;

  @MinLength(8)
  password!: string;

  @IsOptional()
  companyName?: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.name, dto.password, dto.companyName);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
}
