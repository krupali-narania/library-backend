import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class LibraryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const resourceLibraryId =
      request.body.libraryId ||
      request.params.libraryId ||
      request.query.libraryId;

    if (!resourceLibraryId) return true;

    if (Number(resourceLibraryId) !== user.libraryId) {
      throw new ForbiddenException('Cross-library access denied');
    }

    return true;
  }
}
