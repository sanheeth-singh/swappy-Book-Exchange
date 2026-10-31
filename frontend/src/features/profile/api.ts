import { protectedRequest } from "@/features/auth/session";
import type { User } from "@/features/auth/types";
import type { components } from "@/lib/api/generated/schema";
export type Campus = components["schemas"]["CampusResponse"];
export async function getCampuses(q: string, offset: number) { return protectedRequest<Campus[]>({ url: "/campuses", params: { q: q || undefined, limit: 50, offset } }); }
export async function saveProfile(data: components["schemas"]["ProfileInput"]) { return protectedRequest<User>({ method: "PUT", url: "/users/me/profile", data }); }
