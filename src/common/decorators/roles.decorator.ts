import { SetMetadata } from '@nestjs/common';
import type { Role } from '../constants/roles';

export const ROLES_KEY = 'requiredRole';

/**
 * Exige un rol mínimo para acceder a la ruta. La jerarquía es acumulativa:
 * `@RequireRole('moderator')` deja pasar también a los admin.
 */
export const RequireRole = (role: Role) => SetMetadata(ROLES_KEY, role);
