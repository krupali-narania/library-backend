import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class HierarchyGuard implements CanActivate {
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUser = request.user;

    const targetUserId = Number(request.params.userId);

    if (!targetUserId) return true;

    // Allow self
    if (currentUser.id === targetUserId) return true;

    // Get descendants recursively
    const descendants = await this.usersService.getAllDescendants(
      currentUser.id,
    );

    const allowedIds = descendants.map((u) => u.id);

    if (!allowedIds.includes(targetUserId)) {
      throw new ForbiddenException('Hierarchy access denied');
    }

    return true;
  }
}
