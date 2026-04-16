import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { HierarchyGuard } from './hierarchy.guard';
import { LibraryGuard } from './library.guard';

@Module({
  imports: [UsersModule],
  providers: [JwtAuthGuard, RolesGuard, HierarchyGuard, LibraryGuard],
  exports: [JwtAuthGuard, RolesGuard, HierarchyGuard, LibraryGuard],
})
export class GuardsModule {}
