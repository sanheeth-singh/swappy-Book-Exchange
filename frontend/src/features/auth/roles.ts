import { ApiError } from "@/lib/api/errors";
import type { User } from "./types";
export function requireKnownRole(user: User): User {
  if (typeof user.is_admin !== "boolean")
    throw new ApiError(
      "Backend update required: /users/me must return is_admin. Apply the Stage 3 response-schema update and restart FastAPI.",
    );
  return user;
}
export function destination(user: User) {
  requireKnownRole(user);
  return user.is_admin
    ? "/admin"
    : user.display_name && user.campus_id
      ? "/books"
      : "/profile";
}
