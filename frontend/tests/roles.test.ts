import test from "node:test";
import assert from "node:assert/strict";
import { destination, requireKnownRole } from "../src/features/auth/roles";
import type { User } from "../src/features/auth/types";
const user: User = {
  id: "u",
  email: "a@example.com",
  is_admin: false,
  display_name: null,
  campus_id: null,
  is_participation_restricted: false,
  avatar_id: "default",
  bio: null,
  reading_interests: [],
};
test("administrator destination never depends on student profile or verification", () => {
  assert.equal(destination({ ...user, is_admin: true }), "/admin");
  assert.equal(destination(user), "/profile");
  assert.equal(
    destination({ ...user, display_name: "Ben", campus_id: "campus" }),
    "/books",
  );
});
test("missing role fails closed instead of treating administrator as a student", () => {
  assert.throws(
    () => requireKnownRole({ ...user, is_admin: undefined } as unknown as User),
    /Backend update required/,
  );
});
