import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookFiltersDto } from './dto/book-filters.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';

const bookCoverStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = 'uploads/books';
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('frontPageFile', { storage: bookCoverStorage }),
  )
  create(
    @Request() req,
    @Body() dto: CreateBookDto,
    @UploadedFile() file?: any,
  ) {
    const frontPagePath = file ? `/uploads/books/${file.filename}` : undefined;
    return this.booksService.create(req.user, dto, frontPagePath);
  }

  @Get('list')
  findList(@Request() req, @Query() query: BookFiltersDto) {
    return this.booksService.findList(req.user, query);
  }

  @Get()
  findAll(@Request() req, @Query() filters: BookFiltersDto) {
    return this.booksService.findAll(req.user, filters);
  }

  @Get('search')
  search(@Request() req, @Query() filters: BookFiltersDto) {
    return this.booksService.search(req.user, filters.q || '');
  }

  @Get('meta')
  meta(@Request() req) {
    return this.booksService.getMeta(req.user);
  }

  @Get(':id/history')
  history(@Request() req, @Param('id') id: number) {
    return this.booksService.getBookHistory(req.user, +id);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: number) {
    return this.booksService.findOne(req.user, +id);
  }

  @Put(':id')
  @UseInterceptors(
    FileInterceptor('frontPageFile', { storage: bookCoverStorage }),
  )
  update(
    @Request() req,
    @Param('id') id: number,
    @Body() dto: UpdateBookDto,
    @UploadedFile() file?: any,
  ) {
    const frontPagePath = file ? `/uploads/books/${file.filename}` : undefined;
    return this.booksService.update(req.user, +id, dto, frontPagePath);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: number) {
    return this.booksService.remove(req.user, +id);
  }
}
