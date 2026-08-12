import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { hasRole, type Role } from '../constants/roles';
import type { JwtPayload } from '../decorators/current-user.decorator';

/**
 * Comprueba el rol mínimo declarado con `@RequireRole`. Se registra después del
 * guard JWT, así que `request.user` ya viene resuelto.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!hasRole(request.user?.role, required)) {
      throw new ForbiddenException('No tienes permisos para hacer esto');
    }
    return true;
  }
}
