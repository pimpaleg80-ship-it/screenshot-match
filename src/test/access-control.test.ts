import { describe, expect, it } from "vitest";
import {
  excludeSuperadminRecords,
  getOrgCreatableRoles,
  getOrgSwitchableRoles,
} from "../lib/access-control";

describe("hierarchical access control & root superadmin stealth", () => {
  it("allows Admins to grant Manager and Employee access during org onboarding", () => {
    expect(getOrgCreatableRoles({ isAdmin: true })).toEqual(["employee", "manager"]);
    expect(getOrgCreatableRoles({ isSuperadmin: true })).toEqual(["employee", "manager"]);
  });

  it("restricts Managers to granting Employee access only", () => {
    expect(getOrgCreatableRoles({ isManager: true })).toEqual(["employee"]);
  });

  it("denies account provisioning roles to standard Employees", () => {
    expect(getOrgCreatableRoles({})).toEqual([]);
  });

  it("restricts Organization Settings role switching to Manager and Employee only", () => {
    expect(getOrgSwitchableRoles({ isAdmin: true })).toEqual(["manager", "employee"]);
    expect(getOrgSwitchableRoles({ isManager: true })).toEqual([]);
    expect(getOrgSwitchableRoles({})).toEqual([]);
  });

  it("filters out Root Superadmin records from organization rosters and lists", () => {
    const filtered = excludeSuperadminRecords([
      { id: "1", email: "hqfluxora@gmail.com", is_superadmin: true, role: "admin" },
      { id: "2", email: "legacy@example.com", is_superadmin: false, role: "super_admin" },
      { id: "3", email: "root@example.com", is_superadmin: false, role: "superadmin" },
      { id: "4", email: "admin@example.com", is_superadmin: false, role: "org_admin" },
      { id: "5", email: "mgr@example.com", is_superadmin: null, role: "hr_manager" },
    ]);

    expect(filtered.map((r) => r.email)).toEqual(["admin@example.com", "mgr@example.com"]);
  });
});
