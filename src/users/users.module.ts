import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { Book } from '../books/entities/book.entity';
import { Assignment } from '../assignments/entities/assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Book, Assignment]), // 🔥 REQUIRED
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

