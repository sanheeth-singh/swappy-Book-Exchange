import { queryOptions } from "@tanstack/react-query";
import { getPublicBooks } from "./api";
import type { PreviewFilters } from "./types";
export const previewKeys = { all: ["public-preview"] as const, list: (filters: PreviewFilters) => ["public-preview", filters] as const };
export function publicBooksOptions(filters: PreviewFilters) { return queryOptions({ queryKey: previewKeys.list(filters), queryFn: ({ signal }) => getPublicBooks(filters, signal) }); }
