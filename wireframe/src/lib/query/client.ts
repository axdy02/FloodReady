import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: (attempt) => attempt * 1000 }, mutations: { retry: false } } });
}
