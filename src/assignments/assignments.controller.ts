import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AssignmentService } from './assignments.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post()
  assign(@Request() req, @Body() dto) {
    return this.assignmentService.assignBook(req.user, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.assignmentService.findAll(req.user);
  }

  @Get('stats')
  stats(@Request() req) {
    return this.assignmentService.stats(req.user);
  }

  @Patch(':id/return')
  returnBook(@Request() req, @Param('id') id: number) {
    return this.assignmentService.returnBook(req.user, +id);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: number) {
    return this.assignmentService.remove(req.user, +id);
  }
}
