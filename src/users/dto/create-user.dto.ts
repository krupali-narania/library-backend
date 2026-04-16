import { Role } from '../entities/user.entity';
import {
  IsEmail,
  MinLength,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsOptional()
  role?: Role;

  // when creating a user from AuthService we need to assign a library
  @IsOptional()
  @IsInt()
  libraryId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  libraryName?: string;
}
