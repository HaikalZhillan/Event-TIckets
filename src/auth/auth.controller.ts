import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from '../modules/users/dto/register.dto';
import { LoginDto } from '../modules/users/dto/login.dto';
import {
  RegisterResponseDto,
  LoginResponseDto,
  UserResponseDto,
} from '../modules/users/dto/user-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const user = await this.authService.register(registerDto);
    
    return {
      message: 'User registered successfully',
      user,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    const { accessToken, user } = await this.authService.login(loginDto);
    
    return {
      message: 'Login successful',
      accessToken,
      user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@CurrentUser() user: any): Promise<UserResponseDto> {
    return this.authService.getCurrentUser(user.id);
  }
}