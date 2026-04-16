import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Library } from '../../libraries/entities/library.entity';
import { Exclude } from 'class-transformer';

export enum Role {
  ADMIN = 'ADMIN',
  LIBRARIAN = 'LIBRARIAN',
  USER = 'USER',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  @ManyToOne(() => Library, (library: Library) => library.users)
  @JoinColumn({ name: 'libraryId' })
  library: Library;

  @Column()
  libraryId: number;

  @Column({ nullable: true })
  libraryName?: string;

  @ManyToOne(() => User, (user) => user.children, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: User;

  @OneToMany(() => User, (user) => user.parent)
  children: User[];

  @Column({ nullable: true })
  parentId: number;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender?: Gender;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ nullable: true })
  avatarPath?: string;

  @DeleteDateColumn()
  deletedAt?: Date;
}
