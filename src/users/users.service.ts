import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, Role } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSubUserDto } from './dto/update-sub-user.dto';
import { Book } from '../books/entities/book.entity';
import { Assignment } from '../assignments/entities/assignment.entity';

export type UserTreeNode = {
  id: number;
  name?: string;
  email: string;
  role: Role;
  libraryId: number;
  parentId?: number;
  children: UserTreeNode[];
};
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
  ) {}

  async create(data: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async findAdminByLibraryName(libraryName: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.libraryName) = LOWER(:name)', {
        name: (libraryName || '').trim(),
      })
      .andWhere('user.role = :role', { role: Role.ADMIN })
      .getOne();
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async getAllDescendants(userId: number): Promise<User[]> {
    const children = await this.userRepository.find({
      where: { parentId: userId },
    });

    let descendants = [...children];

    for (const child of children) {
      const sub = await this.getAllDescendants(child.id);
      descendants = descendants.concat(sub);
    }

    return descendants;
  }

  async getHierarchyForUser(currentUserId: number): Promise<User[]> {
    const current = await this.findById(currentUserId);
    if (!current) {
      throw new BadRequestException('User not found');
    }

    const descendants = await this.getAllDescendants(currentUserId);
    return [current, ...descendants];
  }

  async getHierarchyTree(currentUserId: number): Promise<UserTreeNode | null> {
    const hierarchyUsers = await this.getHierarchyForUser(currentUserId);
    const nodeMap = new Map<number, UserTreeNode>();

    for (const user of hierarchyUsers) {
      nodeMap.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        libraryId: user.libraryId,
        parentId: user.parentId,
        children: [],
      });
    }

    for (const user of hierarchyUsers) {
      if (user.parentId && nodeMap.has(user.parentId) && nodeMap.has(user.id)) {
        nodeMap.get(user.parentId)?.children.push(nodeMap.get(user.id)!);
      }
    }

    return nodeMap.get(currentUserId) ?? null;
  }

  canCreateRole(creatorRole: string, newRole: string): boolean {
    const creator = String(creatorRole || '').toUpperCase();
    const candidate = String(newRole || '').toUpperCase();

    if (creator === 'ADMIN') return ['LIBRARIAN', 'USER'].includes(candidate);
    if (creator === 'LIBRARIAN')
      return ['LIBRARIAN', 'USER'].includes(candidate);
    return false;
  }

  async createSubUser(currentUser: User, dto: CreateUserDto): Promise<User> {
    // ensure the parent user actually exists (and isn't soft-deleted)
    const parent = await this.findById(currentUser.id);
    if (!parent) {
      throw new BadRequestException('Parent user not found');
    }

    // verify email isn't already registered in the system
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const desiredRole = String(dto.role || Role.USER).toUpperCase();
    if (!this.canCreateRole(currentUser.role, desiredRole)) {
      throw new ForbiddenException('You are not allowed to create this role');
    }

    const role = desiredRole === 'LIBRARIAN' ? Role.LIBRARIAN : Role.USER;

    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role,
      libraryId: currentUser.libraryId,
      libraryName: currentUser.libraryName,
      parentId: currentUser.id, // ✅ FIXED
    });

    return this.userRepository.save(user);
  }

  async getProfile(currentUser: Pick<User, 'id'>): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: currentUser.id },
      relations: ['library'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const directChildrenCount = await this.userRepository.count({
      where: { parentId: user.id },
    });
    const descendantsCount = (await this.getAllDescendants(user.id)).length;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      libraryId: user.libraryId,
      libraryName: user.libraryName ?? user.library?.name ?? null,
      parentId: user.parentId,
      gender: user.gender ?? null,
      phone: user.phone ?? null,
      dateOfBirth: user.dateOfBirth ?? null,
      address: user.address ?? null,
      avatarPath: user.avatarPath ?? null,
      directChildrenCount,
      descendantsCount,
    };
  }

  async updateProfile(
    currentUser: Pick<User, 'id'>,
    dto: UpdateProfileDto,
    avatarPath?: string,
  ): Promise<any> {
    const user = await this.findById(currentUser.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing && existing.id !== user.id) {
        throw new BadRequestException('Email already in use');
      }
    }

    user.name = dto.name ?? user.name;
    user.email = dto.email ?? user.email;
    user.gender = dto.gender ?? user.gender;
    user.phone = dto.phone ?? user.phone;
    user.dateOfBirth = dto.dateOfBirth ?? user.dateOfBirth;
    user.address = dto.address ?? user.address;
    user.avatarPath = avatarPath ?? user.avatarPath;
    const updated = await this.userRepository.save(user);

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      libraryId: updated.libraryId,
      libraryName: updated.libraryName ?? null,
      parentId: updated.parentId,
      gender: updated.gender ?? null,
      phone: updated.phone ?? null,
      dateOfBirth: updated.dateOfBirth ?? null,
      address: updated.address ?? null,
      avatarPath: updated.avatarPath ?? null,
    };
  }

  async getDashboardSummary(currentUser: Pick<User, 'id' | 'libraryId'>) {
    const descendants = await this.getAllDescendants(currentUser.id);
    const visibleUserIds = [
      currentUser.id,
      ...descendants.map((user) => user.id),
    ];

    const [totalUsers, totalBooks, totalAssignments] = await Promise.all([
      this.userRepository.count({
        where: { libraryId: currentUser.libraryId },
      }),
      this.bookRepository.count({
        where: { libraryId: currentUser.libraryId },
      }),
      this.assignmentRepository.count({
        where: { libraryId: currentUser.libraryId },
      }),
    ]);

    const visibleAssignments = await this.assignmentRepository.find({
      where: {
        libraryId: currentUser.libraryId,
        userId: In(visibleUserIds),
      },
      select: ['id', 'bookId', 'dueDate', 'returned'],
    });

    const now = new Date();
    let activeAssignments = 0;
    let overdueAssignments = 0;
    let returnedAssignments = 0;

    for (const assignment of visibleAssignments) {
      if (assignment.returned) {
        returnedAssignments += 1;
        continue;
      }

      if (assignment.dueDate && assignment.dueDate < now) {
        overdueAssignments += 1;
      } else {
        activeAssignments += 1;
      }
    }

    const activeBookIds = Array.from(
      new Set(
        visibleAssignments
          .filter((assignment) => !assignment.returned)
          .map((assignment) => assignment.bookId),
      ),
    );
    const overdueBookIds = Array.from(
      new Set(
        visibleAssignments
          .filter(
            (assignment) =>
              !assignment.returned &&
              assignment.dueDate &&
              assignment.dueDate < now,
          )
          .map((assignment) => assignment.bookId),
      ),
    );

    return {
      totalUsers,
      totalBooks,
      totalAssignments,
      activeAssignments,
      overdueAssignments,
      returnedAssignments,
      booksByStatus: {
        available: Math.max(totalBooks - activeBookIds.length, 0),
        assigned: Math.max(activeBookIds.length - overdueBookIds.length, 0),
        overdue: overdueBookIds.length,
      },
    };
  }

  async removeUser(
    currentUser: Pick<User, 'id' | 'role' | 'libraryId'>,
    targetUserId: number,
  ) {
    if (currentUser.id === targetUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const targetUser = await this.findById(targetUserId);
    if (!targetUser || targetUser.libraryId !== currentUser.libraryId) {
      throw new NotFoundException('User not found');
    }

    const descendants = await this.getAllDescendants(currentUser.id);
    const allowedIds = new Set<number>([
      currentUser.id,
      ...descendants.map((u) => u.id),
    ]);

    if (currentUser.role !== Role.ADMIN && !allowedIds.has(targetUserId)) {
      throw new ForbiddenException(
        'You can only delete users in your hierarchy',
      );
    }

    const targetDescendants = await this.getAllDescendants(targetUserId);
    const deleteIds = [
      targetUserId,
      ...targetDescendants.map((user) => user.id),
    ];

    const activeAssignments = await this.assignmentRepository.count({
      where: {
        libraryId: currentUser.libraryId,
        userId: In(deleteIds),
        returned: false,
        deletedAt: IsNull(),
      },
    });

    if (activeAssignments > 0) {
      throw new BadRequestException(
        'Cannot delete user with active assignments in hierarchy',
      );
    }

    await this.userRepository.delete({ id: In(deleteIds) });
    return { message: 'User deleted successfully' };
  }

  async updateSubUser(
    currentUser: Pick<User, 'id' | 'role' | 'libraryId'>,
    targetUserId: number,
    dto: UpdateSubUserDto,
  ) {
    if (currentUser.id === targetUserId) {
      throw new BadRequestException(
        'Use profile update endpoint for your own account',
      );
    }

    if (
      currentUser.role !== Role.ADMIN &&
      currentUser.role !== Role.LIBRARIAN
    ) {
      throw new ForbiddenException(
        'Only ADMIN or LIBRARIAN can update sub users',
      );
    }

    const targetUser = await this.findById(targetUserId);
    if (!targetUser || targetUser.libraryId !== currentUser.libraryId) {
      throw new NotFoundException('User not found');
    }

    const descendants = await this.getAllDescendants(currentUser.id);
    const allowedIds = new Set<number>([
      currentUser.id,
      ...descendants.map((u) => u.id),
    ]);

    if (currentUser.role !== Role.ADMIN && !allowedIds.has(targetUserId)) {
      throw new ForbiddenException(
        'You can only update users in your hierarchy',
      );
    }

    if (targetUser.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Admin account cannot be updated from this endpoint',
      );
    }

    if (dto.email && dto.email !== targetUser.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing && existing.id !== targetUser.id) {
        throw new BadRequestException('Email already in use');
      }
    }

    if (dto.role) {
      if (dto.role === Role.ADMIN) {
        throw new BadRequestException('Cannot assign ADMIN role here');
      }
    }

    targetUser.name = dto.name ?? targetUser.name;
    targetUser.email = dto.email ?? targetUser.email;
    targetUser.role = dto.role ?? targetUser.role;

    if (dto.password) {
      targetUser.password = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.userRepository.save(targetUser);
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      libraryId: updated.libraryId,
      parentId: updated.parentId,
    };
  }
}
