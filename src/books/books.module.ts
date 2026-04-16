import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './entities/book.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Book, Assignment]), UsersModule],
  providers: [BooksService],
  controllers: [BooksController],
  // export the repository (via the TypeOrmModule) and service in case
  // anything else needs them later.  the important part is that the
  // repository provider is available in this module's context.
  exports: [TypeOrmModule, BooksService],
})
export class BooksModule {}
