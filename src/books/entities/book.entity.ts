import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  DeleteDateColumn,
} from 'typeorm';

@Entity()
export class Book {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  author: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  frontPageUrl: string;

  @Column({ type: 'int', nullable: true })
  totalPages: number;

  @Column({ nullable: true })
  genre: string;

  @Column({ nullable: true })
  language: string;

  @Column({ nullable: true })
  publisher: string;

  @Column({ type: 'int', nullable: true })
  publishedYear: number;

  @Column({ nullable: true })
  isbn: string;

  @Column()
  libraryId: number;

  
  @Column({ nullable: true })
  createdById: number;

  @DeleteDateColumn()
  deletedAt: Date;
}

