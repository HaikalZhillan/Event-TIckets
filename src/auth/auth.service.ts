import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../entities/role.entity';
import { RegisterDto } from '../modules/users/dto/register.dto';
import { LoginDto } from '../modules/users/dto/login.dto';
import { User } from 'src/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly jwtService: JwtService,
  ) {}

   async register(registerDto: RegisterDto) {
    const { email, name, password } = registerDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const userRole = await this.roleRepository.findOne({
      where: { name: 'user' },
    });
    if (!userRole) {
      throw new NotFoundException(
        'Default user role not found. Please seed the database first.',
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      email,
      name,
      password: hashedPassword,
      roleId: userRole.id,
      isVerified: false,
    });

    await this.userRepository.save(user);

    const { password: _, ...userWithoutPassword } = user;

    return {
      message: 'User registered successfully',
      user: userWithoutPassword,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const role = await this.roleRepository.findOne({
      where: { id: user.roleId },
    });

    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const payload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: role?.name || 'user',
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: role?.name || 'user',
        isVerified: user.isVerified,
      },
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    const role = await this.roleRepository.findOne({
      where: { id: user.roleId },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      role: role?.name || 'user',
    };
  }

  async validateUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const role = await this.roleRepository.findOne({
      where: { id: user.roleId },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      roleName: role?.name || 'user',
    };
  }
}
