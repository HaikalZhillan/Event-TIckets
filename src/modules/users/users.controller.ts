import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UsersService } from './users.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Roles('admin')
    @Get()
    findAll() {
        return this.usersService.findAll();
    }
    
    @Roles('admin')
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.findOne(id);
    }

    @Get('profile/me')
    getProfile(@CurrentUser() user: any) {
        return this.usersService.getProfile(user.id);
    }

    @Patch('profile/me')
    updateProfile(@CurrentUser() user: any, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.updateProfile(user.id, updateUserDto);
    }
}
