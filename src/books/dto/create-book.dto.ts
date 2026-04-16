import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  author: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  frontPageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalPages?: number;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(3000)
  publishedYear?: number;

  @IsOptional()
  @IsString()
  isbn?: string;
}
