export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  roleId: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  role: string; // role name sebagai string
}

export class LoginResponseDto {
  message: string;
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isVerified: boolean;
  };
}

export class RegisterResponseDto {
  message: string;
  user: UserResponseDto;
}