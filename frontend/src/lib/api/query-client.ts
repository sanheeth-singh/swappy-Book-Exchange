import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./errors";
export function makeQueryClient() { return new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: (count, error) => !(error instanceof ApiError && error.status && error.status < 500) && count < 1, refetchOnWindowFocus: true }, mutations: { retry: false } } }); }
