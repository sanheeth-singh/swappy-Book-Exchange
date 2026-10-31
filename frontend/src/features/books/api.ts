import { protectedRequest } from "@/features/auth/session";
import type {
  Book,
  BookCreate,
  BookInput,
  GenreOption,
  PhysicalBook,
  Recommendations,
} from "./types";
export const bookKeys = {
  all: ["books"] as const,
  detail: (id: string) => ["books", "detail", id] as const,
};
export const booksApi = {
  list: (
    params: { q?: string; genre?: string; offset: number; limit: number },
    signal?: AbortSignal,
  ) => protectedRequest<Book[]>({ url: "/books", params, signal }),
  mine: (offset = 0, signal?: AbortSignal) =>
    protectedRequest<Book[]>({
      url: "/books/me",
      params: { offset, limit: 12 },
      signal,
    }),
  collection: (offset = 0, signal?: AbortSignal) =>
    protectedRequest<PhysicalBook[]>({
      url: "/books/collection",
      params: { offset, limit: 12 },
      signal,
    }),
  genres: () => protectedRequest<GenreOption[]>({ url: "/books/genres" }),
  recommendations: () =>
    protectedRequest<Recommendations>({ url: "/books/recommendations" }),
  detail: (id: string, signal?: AbortSignal) =>
    protectedRequest<Book>({ url: `/books/${id}`, signal }),
  create: (data: BookCreate) =>
    protectedRequest<Book>({ method: "POST", url: "/books", data }),
  update: (id: string, data: BookInput) =>
    protectedRequest<Book>({ method: "PUT", url: `/books/${id}`, data }),
  archive: (id: string) =>
    protectedRequest<Book>({ method: "POST", url: `/books/${id}/archive` }),
  preview: (id: string, allow_public_preview: boolean) =>
    protectedRequest<Book>({
      method: "PATCH",
      url: `/books/${id}/public-preview`,
      data: { allow_public_preview },
    }),
  removePhoto: (id: string, photoId: string) =>
    protectedRequest<void>({
      method: "DELETE",
      url: `/books/${id}/photos/${photoId}`,
    }),
  photo: (id: string, photo: File) => {
    const data = new FormData();
    data.append("photo", photo);
    return protectedRequest({
      method: "POST",
      url: `/books/${id}/photos`,
      data,
    });
  },
};
