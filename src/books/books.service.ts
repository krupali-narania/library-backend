import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Brackets } from 'typeorm';
import { Book } from './entities/book.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { UsersService } from '../users/users.service';
import { Role } from '../users/entities/user.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookFiltersDto } from './dto/book-filters.dto';

type AuthUser = {
  id: number;
  role: Role | string;
  libraryId: number;
};

type BookStatus = 'AVAILABLE' | 'ASSIGNED' | 'OVERDUE';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    private readonly usersService: UsersService,
  ) {}

  private isSuperUser(user: AuthUser): boolean {
    return user.role === Role.ADMIN;
  }

  private async getVisibleUserIds(user: AuthUser): Promise<number[]> {
    const descendants = await this.usersService.getAllDescendants(user.id);
    return [user.id, ...descendants.map((u) => u.id)];
  }

  private async getVisibleBookIdsForUser(user: AuthUser): Promise<number[]> {
    const visibleUserIds = await this.getVisibleUserIds(user);

    const assignments = await this.assignmentRepository.find({
      select: ['bookId'],
      where: {
        libraryId: user.libraryId,
        userId: In(visibleUserIds),
        returned: false,
        deletedAt: IsNull(),
      },
    });

    const createdBooks = await this.bookRepository.find({
      select: ['id'],
      where: {
        libraryId: user.libraryId,
        createdById: user.id,
      },
    });

    return Array.from(
      new Set([
        ...assignments.map((assignment) => assignment.bookId),
        ...createdBooks.map((book) => book.id),
      ]),
    );
  }

  private async hasBookReadAccess(
    user: AuthUser,
    book: Book,
  ): Promise<boolean> {
    if (this.isSuperUser(user) || book.createdById === user.id) {
      return true;
    }

    const visibleUserIds = await this.getVisibleUserIds(user);

    const assignment = await this.assignmentRepository.findOne({
      where: {
        libraryId: user.libraryId,
        bookId: book.id,
        userId: In(visibleUserIds),
        returned: false,
        deletedAt: IsNull(),
      },
    });

    return Boolean(assignment);
  }

  private canManageBook(user: AuthUser, book: Book): boolean {
    return this.isSuperUser(user) || book.createdById === user.id;
  }

  private async findEntityById(user: AuthUser, id: number): Promise<Book> {
    const book = await this.bookRepository.findOne({
      where: { id, libraryId: user.libraryId },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    return book;
  }

  private async attachStatus(books: Book[], libraryId: number) {
    if (books.length === 0) return [];

    const bookIds = books.map((book) => book.id);
    const activeAssignments = await this.assignmentRepository.find({
      where: {
        libraryId,
        bookId: In(bookIds),
        returned: false,
        deletedAt: IsNull(),
      },
      order: { assignedAt: 'DESC' },
    });

    const assignmentByBookId = new Map<number, Assignment>();
    for (const assignment of activeAssignments) {
      if (!assignmentByBookId.has(assignment.bookId)) {
        assignmentByBookId.set(assignment.bookId, assignment);
      }
    }

    const now = new Date();

    return books.map((book) => {
      const assignment = assignmentByBookId.get(book.id);
      let status: BookStatus = 'AVAILABLE';
      let overdueDays = 0;

      if (assignment) {
        if (assignment.dueDate && assignment.dueDate < now) {
          status = 'OVERDUE';
          overdueDays = Math.ceil(
            (now.getTime() - assignment.dueDate.getTime()) /
              (1000 * 60 * 60 * 24),
          );
        } else {
          status = 'ASSIGNED';
        }
      }

      return {
        ...book,
        status,
        overdueDays,
        currentAssignmentId: assignment?.id ?? null,
        assignedToUserId: assignment?.userId ?? null,
        dueDate: assignment?.dueDate ?? null,
        assignedAt: assignment?.assignedAt ?? null,
      };
    });
  }

  async create(user: AuthUser, dto: CreateBookDto, frontPagePath?: string) {
    const book = this.bookRepository.create({
      ...dto,
      frontPageUrl: frontPagePath ?? dto.frontPageUrl,
      libraryId: user.libraryId,
      createdById: user.id,
    });

    return this.bookRepository.save(book);
  }

  async findAll(user: AuthUser, filters: BookFiltersDto = {}) {
    const query = this.bookRepository
      .createQueryBuilder('book')
      .where('book.libraryId = :libraryId', { libraryId: user.libraryId });

    if (filters.q?.trim()) {
      const q = `%${filters.q.trim().toLowerCase()}%`;
      query.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(book.title) LIKE :q', { q })
            .orWhere('LOWER(book.author) LIKE :q', { q })
            .orWhere('LOWER(book.genre) LIKE :q', { q })
            .orWhere('LOWER(book.language) LIKE :q', { q })
            .orWhere('LOWER(book.publisher) LIKE :q', { q })
            .orWhere('LOWER(book.isbn) LIKE :q', { q })
            .orWhere('LOWER(book.description) LIKE :q', { q })
            .orWhere('CAST(book.publishedYear AS TEXT) LIKE :q', { q })
            .orWhere('CAST(book.totalPages AS TEXT) LIKE :q', { q });
        }),
      );
    }
    if (filters.title) {
      query.andWhere('book.title ILIKE :title', {
        title: `%${filters.title}%`,
      });
    }
    if (filters.author) {
      query.andWhere('book.author ILIKE :author', {
        author: `%${filters.author}%`,
      });
    }
    if (filters.genre) {
      query.andWhere('book.genre ILIKE :genre', {
        genre: `%${filters.genre}%`,
      });
    }
    if (filters.language) {
      query.andWhere('book.language ILIKE :language', {
        language: `%${filters.language}%`,
      });
    }
    if (filters.publisher) {
      query.andWhere('book.publisher ILIKE :publisher', {
        publisher: `%${filters.publisher}%`,
      });
    }
    if (filters.publishedYear) {
      query.andWhere('book.publishedYear = :publishedYear', {
        publishedYear: filters.publishedYear,
      });
    }

    let books: Book[];

    if (this.isSuperUser(user)) {
      books = await query.orderBy('book.id', 'DESC').getMany();
    } else {
      const visibleBookIds = await this.getVisibleBookIdsForUser(user);
      if (visibleBookIds.length === 0) {
        return [];
      }

      query.andWhere('book.id IN (:...visibleBookIds)', { visibleBookIds });
      books = await query.orderBy('book.id', 'DESC').getMany();
    }

    const booksWithStatus = await this.attachStatus(books, user.libraryId);

    if (filters.status) {
      const normalizedStatus = filters.status.toUpperCase();
      return booksWithStatus.filter((book) => book.status === normalizedStatus);
    }

    return booksWithStatus;
  }

  async findList(user: AuthUser, query: any) {
    const qb = this.bookRepository
      .createQueryBuilder('book')
      .select([
        'book.id',
        'book.title',
        'book.author',
        'book.frontPageUrl',
        'book.genre',
      ])
      .where('book.libraryId = :libraryId', { libraryId: user.libraryId });

    if (query.q?.trim()) {
      const q = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((qb2) => {
          qb2
            .where('LOWER(book.title) LIKE :q', { q })
            .orWhere('LOWER(book.author) LIKE :q', { q })
            .orWhere('LOWER(book.genre) LIKE :q', { q })
            .orWhere('LOWER(book.language) LIKE :q', { q })
            .orWhere('LOWER(book.publisher) LIKE :q', { q })
            .orWhere('LOWER(book.isbn) LIKE :q', { q })
            .orWhere('LOWER(book.description) LIKE :q', { q })
            .orWhere('CAST(book.publishedYear AS TEXT) LIKE :q', { q })
            .orWhere('CAST(book.totalPages AS TEXT) LIKE :q', { q });
        }),
      );
    }

    if (query.title) {
      qb.andWhere('book.title ILIKE :title', { title: `%${query.title}%` });
    }
    if (query.author) {
      qb.andWhere('book.author ILIKE :author', { author: `%${query.author}%` });
    }
    if (query.genre) {
      qb.andWhere('book.genre ILIKE :genre', { genre: `%${query.genre}%` });
    }
    if (query.language) {
      qb.andWhere('book.language ILIKE :language', {
        language: `%${query.language}%`,
      });
    }
    if (query.publisher) {
      qb.andWhere('book.publisher ILIKE :publisher', {
        publisher: `%${query.publisher}%`,
      });
    }
    if (query.publishedYear) {
      qb.andWhere('book.publishedYear = :publishedYear', {
        publishedYear: query.publishedYear,
      });
    }

    let books: Book[];

    if (this.isSuperUser(user)) {
      books = await qb.orderBy('book.id', 'DESC').getMany();
    } else {
      const visibleBookIds = await this.getVisibleBookIdsForUser(user);
      if (visibleBookIds.length === 0) {
        return [];
      }

      qb.andWhere('book.id IN (:...visibleBookIds)', { visibleBookIds });
      books = await qb.orderBy('book.id', 'DESC').getMany();
    }

    const booksWithStatus = await this.attachStatus(books, user.libraryId);

    const filteredBooks = query.status
      ? booksWithStatus.filter(
          (book) => book.status === String(query.status || '').toUpperCase(),
        )
      : booksWithStatus;

    // Return a minimal payload for list views.
    return filteredBooks.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      frontPageUrl: book.frontPageUrl,
      genre: book.genre,
    }));
  }

  async findOne(user: AuthUser, id: number) {
    const book = await this.findEntityById(user, id);

    const canRead = await this.hasBookReadAccess(user, book);
    if (!canRead) {
      throw new ForbiddenException('You do not have access to this book');
    }

    const [bookWithStatus] = await this.attachStatus([book], user.libraryId);
    return bookWithStatus;
  }

  async update(
    user: AuthUser,
    id: number,
    dto: UpdateBookDto,
    frontPagePath?: string,
  ) {
    const book = await this.findEntityById(user, id);

    const canRead = await this.hasBookReadAccess(user, book);
    if (!canRead) {
      throw new ForbiddenException('You do not have access to this book');
    }

    if (!this.canManageBook(user, book)) {
      throw new ForbiddenException('You are not allowed to update this book');
    }

    const safeDto: Partial<UpdateBookDto> = { ...dto };
    if (frontPagePath) {
      safeDto.frontPageUrl = frontPagePath;
    }
    Object.assign(book, safeDto);

    return this.bookRepository.save(book);
  }

  async remove(user: AuthUser, id: number) {
    const book = await this.findEntityById(user, id);

    const canRead = await this.hasBookReadAccess(user, book);
    if (!canRead) {
      throw new ForbiddenException('You do not have access to this book');
    }

    if (!this.canManageBook(user, book)) {
      throw new ForbiddenException('You are not allowed to delete this book');
    }

    await this.bookRepository.remove(book);
    return { message: 'Book deleted successfully' };
  }

  async search(user: AuthUser, query: string) {
    return this.findAll(user, { q: query });
  }

  async getMeta(user: AuthUser) {
    const books = await this.bookRepository.find({
      where: { libraryId: user.libraryId },
      select: ['author', 'genre', 'language', 'publisher', 'publishedYear'],
    });

    const pickDistinct = (field: keyof Book): string[] =>
      Array.from(
        new Set(
          books
            .map((book) => String(book[field] ?? '').trim())
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b));

    const years = Array.from(
      new Set(
        books
          .map((book) => Number(book.publishedYear))
          .filter((value) => Number.isInteger(value)),
      ),
    ).sort((a, b) => a - b);

    return {
      authors: pickDistinct('author'),
      genres: pickDistinct('genre'),
      languages: pickDistinct('language'),
      publishers: pickDistinct('publisher'),
      years,
    };
  }

  async getBookHistory(user: AuthUser, id: number) {
    const book = await this.findEntityById(user, id);
    const canRead = await this.hasBookReadAccess(user, book);
    if (!canRead) {
      throw new ForbiddenException('You do not have access to this book');
    }

    const history = await this.assignmentRepository.find({
      where: {
        libraryId: user.libraryId,
        bookId: id,
      },
      relations: ['user'],
      order: { assignedAt: 'DESC' },
      take: 20,
    });

    const now = new Date();
    return history.map((assignment) => {
      const isOverdue =
        !assignment.returned &&
        Boolean(assignment.dueDate) &&
        assignment.dueDate < now;

      return {
        id: assignment.id,
        bookId: assignment.bookId,
        userId: assignment.userId,
        userName:
          assignment.user?.name ||
          assignment.user?.email ||
          `User ${assignment.userId}`,
        userEmail: assignment.user?.email || '',
        user: assignment.user
          ? {
              id: assignment.user.id,
              name: assignment.user.name,
              email: assignment.user.email,
              role: assignment.user.role,
            }
          : null,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate,
        returned: assignment.returned,
        returnedDate: assignment.returnedDate ?? null,
        status: assignment.returned
          ? 'RETURNED'
          : isOverdue
            ? 'OVERDUE'
            : 'ACTIVE',
      };
    });
  }
}
