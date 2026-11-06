import { describe, it, expect } from "vitest";

describe("Multi-Tenancy & SaaS Role Hierarchy", () => {
  const roleHierarchy = {
    super_admin: ["super_admin", "org_admin", "hr_manager", "employee"],
    org_admin: ["org_admin", "hr_manager", "employee"],
    hr_manager: ["hr_manager", "employee"],
    employee: ["employee"],
  };

  function hasAccess(userRole: keyof typeof roleHierarchy, requiredRole: string): boolean {
    return roleHierarchy[userRole]?.includes(requiredRole) || false;
  }

  it("grants super_admin access to all administrative scopes", () => {
    expect(hasAccess("super_admin", "super_admin")).toBe(true);
    expect(hasAccess("super_admin", "org_admin")).toBe(true);
    expect(hasAccess("super_admin", "hr_manager")).toBe(true);
    expect(hasAccess("super_admin", "employee")).toBe(true);
  });

  it("restricts org_admin from super_admin operations while permitting org operations", () => {
    expect(hasAccess("org_admin", "super_admin")).toBe(false);
    expect(hasAccess("org_admin", "org_admin")).toBe(true);
    expect(hasAccess("org_admin", "hr_manager")).toBe(true);
    expect(hasAccess("org_admin", "employee")).toBe(true);
  });

  it("restricts hr_manager from org_admin operations", () => {
    expect(hasAccess("hr_manager", "super_admin")).toBe(false);
    expect(hasAccess("hr_manager", "org_admin")).toBe(false);
    expect(hasAccess("hr_manager", "hr_manager")).toBe(true);
    expect(hasAccess("hr_manager", "employee")).toBe(true);
  });

  it("restricts employee to personal portal operations", () => {
    expect(hasAccess("employee", "super_admin")).toBe(false);
    expect(hasAccess("employee", "org_admin")).toBe(false);
    expect(hasAccess("employee", "hr_manager")).toBe(false);
    expect(hasAccess("employee", "employee")).toBe(true);
  });
});
