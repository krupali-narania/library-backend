import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { LibrariesService } from '../libraries/libraries.service';
import { UsersService } from '../users/users.service';
import { Role } from '../users/entities/user.entity';
import { TokenUser } from './interfaces/token-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private librariesService: LibrariesService,
    private usersService: UsersService,
  ) {}

  async signup(dto: SignupDto) {
    const libraryName = dto.libraryName?.trim() ?? '';

    const existingAdmin =
      await this.usersService.findAdminByLibraryName(libraryName);
    if (existingAdmin) {
      throw new ConflictException(
        `Library name "${dto.libraryName}" is already taken. Please choose a different name.`,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const library = await this.librariesService.create(libraryName);

    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: Role.ADMIN,
      libraryId: library.id,
      libraryName: libraryName,
    });

    return this.generateToken({
      id: user.id,
      role: user.role,
      libraryId: user.libraryId,
    });
  }
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) throw new UnauthorizedException();

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException();

    return this.generateToken({
      id: user.id,
      role: user.role,
      libraryId: user.libraryId,
    });
  }

  generateToken(user: TokenUser) {
    return {
      access_token: this.jwtService.sign({
        sub: user.id,
        role: user.role,
        libraryId: user.libraryId,
      }),
    };
  }
}
