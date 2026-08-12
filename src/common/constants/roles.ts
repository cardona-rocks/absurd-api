/** Roles de usuario, de menor a mayor privilegio. */
export const ROLES = ['player', 'moderator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Jerarquía: un rol cubre todos los de nivel inferior. */
const RANK: Record<Role, number> = {
  player: 0,
  moderator: 1,
  admin: 2,
};

/** True si `role` alcanza el nivel mínimo pedido. */
export function hasRole(role: Role | undefined, minimum: Role): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[minimum];
}

/** Roles con acceso al panel de administración. */
export const STAFF_ROLES: Role[] = ['moderator', 'admin'];
