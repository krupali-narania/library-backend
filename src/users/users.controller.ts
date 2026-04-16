import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getMyHierarchy(@Request() req) {
    return this.usersService.getHierarchyForUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('hierarchy')
  async getHierarchy(@Request() req) {
    return this.usersService.getHierarchyForUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tree')
  async getTree(@Request() req) {
    return this.usersService.getHierarchyTree(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.usersService.getProfile(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard-summary')
  async getDashboardSummary(@Request() req) {
    return this.usersService.getDashboardSummary(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sub-user')
  async createSubUser(@Request() req, @Body() dto: CreateUserDto) {
    return this.usersService.createSubUser(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async removeUser(@Request() req, @Param('id') id: number) {
    return this.usersService.removeUser(req.user, +id);
  }
}
