import { IsEmail, IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' }) // ✅ Perbaiki: "mudt" → "must"
  password: string;
}
