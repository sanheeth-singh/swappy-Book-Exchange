import { api } from "@/lib/api/client";
import type { PreviewFilters, PreviewResponse } from "./types";
export async function getPublicBooks(filters: PreviewFilters, signal?: AbortSignal): Promise<PreviewResponse> { const { data } = await api.get<PreviewResponse>("/public/books", { params: { q: filters.q || undefined, genre: filters.genre || undefined, offset: filters.offset, limit: 12 }, signal }); return data; }
