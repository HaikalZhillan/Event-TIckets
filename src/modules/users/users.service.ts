import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/entities/user.entity';
import { Role } from 'src/entities/role.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

// ✅ Interface untuk return type yang jelas
interface UsersListResponse {
  total: number;
  users: UserResponseDto[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  // ✅ Strict return type
  async findAll(): Promise<UsersListResponse> {
    const users = await this.userRepository.find({
      select: [
        'id',
        'email',
        'name',
        'isVerified',
        'lastLogin',
        'roleId',
        'createdAt',
        'updatedAt',
      ],
    });

    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const role = await this.roleRepository.findOne({
          where: { id: user.roleId },
        });
        return {
          ...user,
          role: role?.name || 'user',
        } as UserResponseDto;
      }),
    );

    return {
      total: usersWithRoles.length,
      users: usersWithRoles,
    };
  }

  // ✅ Strict return type
  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  // ✅ Strict return type
  async findOneWithRoleName(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'name',
        'isVerified',
        'lastLogin',
        'roleId',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    const role = await this.roleRepository.findOne({
      where: { id: user.roleId },
    });

    return {
      ...user,
      role: role?.name || 'user',
    } as UserResponseDto;
  }

  // ✅ Strict return type
  async getProfile(userId: string): Promise<UserResponseDto> {
    return this.findOneWithRoleName(userId);
  }

  // ✅ Service TIDAK return message, hanya data
  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    await this.userRepository.save(user);

    // Exclude password dan role entity
    const { password: _, role: __, ...userWithoutPassword } = user;

    const role = await this.roleRepository.findOne({
      where: { id: user.roleId },
    });

    // ❌ DIHAPUS: message
    // ✅ Service hanya return data
    return {
      ...userWithoutPassword,
      role: role?.name || 'user',
    } as UserResponseDto;
  }

  // ✅ Strict return type
  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['role'],
    });
    return user;
  }

  // ✅ Strict return type
  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
      relations: ['role'],
    });
  }
}