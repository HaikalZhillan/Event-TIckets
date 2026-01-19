import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UsersService } from './users.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from 'src/entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('admin')
  @Get()
  // ✅ Strict return type
  async findAll(): Promise<{
    total: number;
    users: UserResponseDto[];
  }> {
    return this.usersService.findAll();
  }

  @Roles('admin')
  @Get(':id')
  // ✅ Strict return type
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  @Get('profile/me')
  // ✅ Strict return type
  async getProfile(@CurrentUser() user: any): Promise<UserResponseDto> {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile/me')
  // ✅ Strict return type dan message ada di controller
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{
    message: string;
    user: UserResponseDto;
  }> {
    const updatedUser = await this.usersService.updateProfile(
      user.id,
      updateUserDto,
    );

    // ✅ Message ada di controller, bukan service
    return {
      message: 'Profile updated successfully',
      user: updatedUser,
    };
  }
}