import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Book } from '../../books/entities/book.entity';

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  libraryId: number;

  @Column()
  bookId: number;

  @Column()
  userId: number;

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookId' })
  book!: Book;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'timestamp' })
  assignedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({ default: false })
  returned: boolean;

  @Column({ type: 'date', nullable: true })
  returnedDate?: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @DeleteDateColumn()
  deletedAt?: Date;
}
