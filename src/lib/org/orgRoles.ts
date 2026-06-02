// ── Org role ranking ──
//
// Org tier is deliberately simple: owner > admin > member.
// Owner: full control incl. billing, transfer, delete.
// Admin: manage members + org settings (not billing/delete).
// Member: normal user.

export type OrgRole = "owner" | "admin" | "member";

export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  member: 0,
  admin: 1,
  owner: 2,
};

/** True iff `role` meets or exceeds the `min` required role. */
export function hasOrgRole(role: OrgRole, min: OrgRole): boolean {
  return ORG_ROLE_RANK[role] >= ORG_ROLE_RANK[min];
}
