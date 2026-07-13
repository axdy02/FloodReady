export const queryKeys = {
  actor: (actorId: string, resource: string) => ["actor", actorId, resource] as const,
  users: (filters: Record<string, string | null>) => ["users", Object.entries(filters).sort()] as const,
  reports: (scope: "all" | "own", filters: Record<string, string | null>) => ["reports", scope, Object.entries(filters).sort()] as const,
  map: (actorId: string, filters: Record<string, string | null>) => ["reports", "map", actorId, Object.entries(filters).sort()] as const,
  incidents: (filters: Record<string, string | null>) => ["incidents", Object.entries(filters).sort()] as const
};
