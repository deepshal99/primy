"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Org data hook ──
//
// Thin TanStack Query wrapper over the /api/orgs endpoints. One org per user,
// so the shape is simple: a single org summary (or null) + its members.

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: "owner" | "admin" | "member";
}

export interface OrgMember {
  userId: string;
  role: string;
  status: string;
  email: string;
  name: string;
}

async function getJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Request failed (${r.status})`);
  return r.json();
}

export function useOrg() {
  const qc = useQueryClient();

  const orgQuery = useQuery<{ org: OrgSummary | null }>({
    queryKey: ["org"],
    queryFn: () => getJson("/api/orgs"),
    staleTime: 60_000,
  });
  const org = orgQuery.data?.org ?? null;

  const membersQuery = useQuery<{ members: OrgMember[] }>({
    queryKey: ["org", org?.id, "members"],
    queryFn: () => getJson(`/api/orgs/${org!.id}/members`),
    enabled: !!org?.id,
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["org"] });
    // Plan can change (org pro inheritance) → refresh plan surfaces too.
    qc.invalidateQueries({ queryKey: ["user"] });
    qc.invalidateQueries({ queryKey: ["planInfo"] });
  };

  const createOrg = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to create org");
      return r.json();
    },
    onSuccess: invalidate,
  });

  const invite = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: "admin" | "member" }) => {
      const r = await fetch(`/api/orgs/${org!.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to invite");
      return r.json();
    },
    onSuccess: invalidate,
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`/api/orgs/${org!.id}/members?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to remove");
      return r.json();
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch(`/api/orgs/${org!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to rename");
      return r.json();
    },
    onSuccess: invalidate,
  });

  const deleteOrg = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/orgs/${org!.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to delete");
      return r.json();
    },
    onSuccess: invalidate,
  });

  return {
    org,
    members: membersQuery.data?.members ?? [],
    loading: orgQuery.isLoading,
    membersLoading: membersQuery.isLoading,
    createOrg,
    invite,
    removeMember,
    rename,
    deleteOrg,
  };
}
