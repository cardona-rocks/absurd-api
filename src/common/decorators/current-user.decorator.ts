import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '../constants/roles';

/**
 * Lo que la estrategia JWT deja en `request.user`. El rol viaja aquí para que
 * el guard no tenga que consultar la base de datos en cada petición.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof JwtPayload | undefined,
    ctx: ExecutionContext,
  ): JwtPayload | string => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user as JwtPayload;
    return data ? user?.[data] : user;
  },
);
