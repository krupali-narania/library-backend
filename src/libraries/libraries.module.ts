import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibrariesService } from './libraries.service';
import { LibrariesController } from './libraries.controller';
import { Library } from './entities/library.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Library]), // VERY IMPORTANT
  ],
  controllers: [LibrariesController],
  providers: [LibrariesService],
  exports: [LibrariesService], // needed for AuthModule
})
export class LibrariesModule {}
