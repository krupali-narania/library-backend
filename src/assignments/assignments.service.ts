import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Assignment } from './entities/assignment.entity';
import { Book } from '../books/entities/book.entity';
import { User, Role } from '../users/entities/user.entity';

@Injectable()
export class AssignmentService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectRepository(Assignment)
    private assignmentRepo: Repository<Assignment>,

    @InjectRepository(Book)
    private bookRepo: Repository<Book>,

    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private overdueTimer: NodeJS.Timeout | null = null;

  async onModuleInit() {
    await this.updateOverdueStatuses();
    this.scheduleNextOverdueRefresh();
  }

  onModuleDestroy() {
    if (this.overdueTimer) {
      clearTimeout(this.overdueTimer);
      this.overdueTimer = null;
    }
  }

  private scheduleNextOverdueRefresh() {
    if (this.overdueTimer) {
      clearTimeout(this.overdueTimer);
    }

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const delay = Math.max(nextMidnight.getTime() - now.getTime(), 1000);

    this.overdueTimer = setTimeout(async () => {
      await this.updateOverdueStatuses();
      this.scheduleNextOverdueRefresh();
    }, delay);
  }

  private async updateOverdueStatuses() {
    const now = new Date();

    await this.assignmentRepo
      .createQueryBuilder()
      .update(Assignment)
      .set({ status: 'OVERDUE' })
      .where('returned = :returned', { returned: false })
      .andWhere('status = :status', { status: 'ACTIVE' })
      .andWhere('dueDate IS NOT NULL')
      .andWhere('dueDate < :today', { today: now })
      .execute();
  }

  private isSuperUser(currentUser: any): boolean {
    return currentUser.role === Role.ADMIN;
  }

  private async getDescendantIds(userId: number): Promise<number[]> {
    const children = await this.userRepo.find({
      where: { parentId: userId },
      select: ['id'],
    });

    let result = children.map((child) => child.id);
    for (const child of children) {
      const nested = await this.getDescendantIds(child.id);
      result = result.concat(nested);
    }
    return result;
  }

  private async getVisibleUserIds(currentUser: any): Promise<number[]> {
    if (this.isSuperUser(currentUser)) {
      const users = await this.userRepo.find({
        where: { libraryId: currentUser.libraryId },
        select: ['id'],
      });
      return users.map((user) => user.id);
    }

    const descendants = await this.getDescendantIds(currentUser.id);
    return [currentUser.id, ...descendants];
  }

  private formatAssignmentRows(assignments: Assignment[]) {
    const now = new Date();

    return assignments.map((assignment) => {
      let status: 'RETURNED' | 'ACTIVE' | 'OVERDUE' = 'ACTIVE';
      let overdueDays = 0;

      if (assignment.returned || assignment.status === 'RETURNED') {
        status = 'RETURNED';
      } else if (assignment.dueDate && assignment.dueDate < now) {
        status = 'OVERDUE';
        overdueDays = Math.ceil(
          (now.getTime() - assignment.dueDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
      }

      return {
        id: assignment.id,
        libraryId: assignment.libraryId,
        bookId: assignment.bookId,
        userId: assignment.userId,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate,
        returnedDate: assignment.returnedDate ?? null,
        returned: assignment.returned,
        status,
        overdueDays,
        isOverdue: status === 'OVERDUE',
        book: assignment.book
          ? {
              id: assignment.book.id,
              title: assignment.book.title,
              author: assignment.book.author,
              frontPageUrl: assignment.book.frontPageUrl ?? null,
            }
          : null,
        user: assignment.user
          ? {
              id: assignment.user.id,
              name: assignment.user.name,
              email: assignment.user.email,
              role: assignment.user.role,
              parentId: assignment.user.parentId,
            }
          : null,
      };
    });
  }

  async assignBook(currentUser: any, dto: any) {
    const book = await this.bookRepo.findOne({
      where: { id: dto.bookId, libraryId: currentUser.libraryId },
    });

    if (!book) throw new NotFoundException('Book not found');

    const targetUser = await this.userRepo.findOne({
      where: { id: dto.userId, libraryId: currentUser.libraryId },
    });

    if (!targetUser) throw new NotFoundException('User not found');

    const visibleUserIds = await this.getVisibleUserIds(currentUser);
    if (!visibleUserIds.includes(targetUser.id)) {
      throw new ForbiddenException('You cannot assign books to this user');
    }

    const existing = await this.assignmentRepo.findOne({
      where: {
        bookId: dto.bookId,
        returned: false,
        deletedAt: IsNull(),
        libraryId: currentUser.libraryId,
      },
    });

    if (existing) throw new BadRequestException('Book already assigned');

    const assignment = this.assignmentRepo.create({
      bookId: dto.bookId,
      userId: dto.userId,
      libraryId: currentUser.libraryId,
      assignedAt: new Date(),
      dueDate: dto.dueDate,
      returned: false,
      status: 'ACTIVE',
    });

    return this.assignmentRepo.save(assignment);
  }

  async findAll(currentUser: any) {
    await this.updateOverdueStatuses();
    const userIds = await this.getVisibleUserIds(currentUser);

    const assignments = await this.assignmentRepo.find({
      where: {
        libraryId: currentUser.libraryId,
        userId: In(userIds),
      },
      relations: ['book', 'user'],
      order: { assignedAt: 'DESC' },
    });

    return this.formatAssignmentRows(assignments);
  }

  async stats(currentUser: any) {
    const assignments = await this.findAll(currentUser);
    return assignments.reduce(
      (acc, assignment) => {
        acc.total += 1;
        if (assignment.status === 'RETURNED') acc.returned += 1;
        else if (assignment.status === 'OVERDUE') acc.overdue += 1;
        else acc.active += 1;
        return acc;
      },
      { total: 0, active: 0, overdue: 0, returned: 0 },
    );
  }

  async returnBook(currentUser: any, id: number) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id, libraryId: currentUser.libraryId },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    assignment.returned = true;
    assignment.status = 'RETURNED';
    assignment.returnedDate = new Date().toISOString().slice(0, 10);
    return this.assignmentRepo.save(assignment);
  }

  async remove(currentUser: any, id: number) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id, libraryId: currentUser.libraryId },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    const visibleUserIds = await this.getVisibleUserIds(currentUser);
    if (
      !this.isSuperUser(currentUser) &&
      !visibleUserIds.includes(assignment.userId)
    ) {
      throw new ForbiddenException('You cannot delete this assignment');
    }

    await this.assignmentRepo.remove(assignment);
    return { message: 'Assignment deleted successfully' };
  }
}
