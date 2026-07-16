import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/features/users/api";
import { authStore } from "@/features/auth/auth-store";
import { queryKeys } from "@/lib/query/keys";

export function useCurrentUserQuery() {
  const token = authStore.getAccessToken();
  const current = authStore.getState();
  const actor = current.kind === "AUTHENTICATED" ? current.user.id : "anonymous";
  return useQuery({ queryKey: queryKeys.actor(actor, "profile"), queryFn: () => usersApi.getMe(token ?? ""), enabled: token !== undefined, retry: false });
}
