import type { components } from "@/lib/api/generated/schema";
export type PublicBook = components["schemas"]["PublicBookCard"];
export type PreviewResponse = components["schemas"]["PublicPreviewResponse"];
export type PreviewFilters = { q: string; genre: string; offset: number };
