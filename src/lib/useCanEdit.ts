import { useAppStore } from "@/lib/store";

/**
 * Whether the current user may edit the open project.
 * owner/editor (and the local-creator default, role === null) can edit;
 * viewer/commenter are read-only.
 */
export function canEditRole(role: string | null | undefined): boolean {
  return role !== "viewer" && role !== "commenter";
}

/** Reactive hook: true when the open project is editable for this user. */
export function useCanEdit(): boolean {
  const role = useAppStore((s) => s.currentProjectRole);
  return canEditRole(role);
}
