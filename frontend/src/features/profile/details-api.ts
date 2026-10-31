import { protectedRequest } from "@/features/auth/session";
import type { components } from "@/lib/api/generated/schema";
type S = components["schemas"];
export const detailsApi = {
  own: () => protectedRequest<S["PublicProfile"]>({ url: "/users/me/profile" }),
  avatars: () =>
    protectedRequest<S["AvatarResponse"][]>({ url: "/users/avatars" }),
  update: (data: S["PublicDetailsInput"]) =>
    protectedRequest<S["UserResponse"]>({
      method: "PATCH",
      url: "/users/me/profile",
      data,
    }),
  books: (id: string, before?: string) =>
    protectedRequest<S["ProfileBooks"]>({
      url: `/users/${id}/books`,
      params: { limit: 12, before },
    }),
};
export function readingInterests(value: string): string[] {
  const seen = new Set<string>();
  const values = value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => {
      if (!v || seen.has(v.toLowerCase())) return false;
      seen.add(v.toLowerCase());
      return true;
    });
  if (
    values.length > 8 ||
    values.some((v) => v.length > 40 || /[\u0000-\u001f]/.test(v))
  )
    throw new Error("Use up to eight interests, each at most 40 characters.");
  return values;
}
