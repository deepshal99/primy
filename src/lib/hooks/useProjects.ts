import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProjects, fetchFullProject, updateProjectOnServer } from "@/lib/api";

export const PROJECTS_QUERY_KEY = ["projects"] as const;

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjects,
  });
}

export function useFullProject(id: string | null) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchFullProject(id!),
    enabled: !!id,
  });
}

export function useSaveProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, any> }) =>
      updateProjectOnServer(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
  });
}
