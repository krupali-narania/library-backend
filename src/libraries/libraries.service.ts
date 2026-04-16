import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Library } from './entities/library.entity';

@Injectable()
export class LibrariesService {
  constructor(
    @InjectRepository(Library)
    private readonly libraryRepository: Repository<Library>,
  ) {}

  async create(name: string): Promise<Library> {
    const library = this.libraryRepository.create({ name });
    return this.libraryRepository.save(library);
  }
}
