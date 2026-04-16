import { IsInt, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignBookDto {
  @IsInt()
  @Type(() => Number)
  bookId: number;

  @IsInt()
  @Type(() => Number)
  userId: number;

  @IsOptional()
  @IsDateString()
  dueDate?: Date;
}
