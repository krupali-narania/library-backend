import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assignment } from './entities/assignment.entity';
import { AssignmentService } from './assignments.service';
import { AssignmentController } from './assignments.controller';
import { Book } from '../books/entities/book.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Assignment, Book, User])],
  providers: [AssignmentService],
  controllers: [AssignmentController],
  exports: [TypeOrmModule, AssignmentService],
})
export class AssignmentsModule {}
