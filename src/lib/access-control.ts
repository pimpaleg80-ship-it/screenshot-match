export type SystemRole = "employee" | "manager" | "admin" | "superadmin";
export type OrgAssignableRole = "employee" | "manager";

export interface RoleActor {
  isSuperadmin?: boolean;
  isAdmin?: boolean;
  isManager?: boolean;
}

/** Roles a user can create via organization registration (`people` / team provisioning). */
export function getOrgCreatableRoles(actor: RoleActor): OrgAssignableRole[] {
  if (actor.isAdmin || actor.isSuperadmin) {
    return ["employee", "manager"];
  }
  if (actor.isManager) {
    return ["employee"];
  }
  return [];
}

/** Roles an Org Admin can switch accounts between inside Organization Settings. */
export function getOrgSwitchableRoles(actor: RoleActor): OrgAssignableRole[] {
  if (actor.isAdmin || actor.isSuperadmin) {
    return ["manager", "employee"];
  }
  return [];
}

/** Defense-in-depth client filter ensuring Root Superadmin records are never displayed inside org views. */
export function excludeSuperadminRecords<
  T extends { is_superadmin?: boolean | null; role?: string | null },
>(rows: readonly T[]): T[] {
  return rows.filter(
    (row) => row.is_superadmin !== true && row.role !== "super_admin" && row.role !== "superadmin",
  );
}
