import test from "node:test";
import assert from "node:assert/strict";
import {
  canEditListing,
  validateBookPhoto,
} from "../src/features/books/policies";
import { validateBookInput } from "../src/features/books/validation";
import type { Book } from "../src/features/books/types";
const book: Book = {
  id: "listing",
  physical_book_id: "copy",
  owner_id: "owner",
  campus_id: "campus",
  title: "Book",
  author: "Author",
  description: "A description",
  condition: "GOOD",
  genre: "FICTION",
  condition_notes: "",
  is_archived: false,
  is_hidden: false,
  is_reserved: false,
  allow_public_preview: false,
  photos: [],
};
test("owner edit affordances respect reservation, archival and moderation locks", () => {
  assert.equal(canEditListing(book, "other"), false);
  for (const flag of ["is_archived", "is_hidden", "is_reserved"] as const)
    assert.equal(canEditListing({ ...book, [flag]: true }, "owner"), false);
  assert.equal(canEditListing(book, "owner"), true);
});
test("book inputs reject whitespace-only descriptions and unsupported photos", () => {
  assert.ok(
    validateBookInput({ ...book, genre: "FICTION", description: "   " }),
  );
  assert.equal(validateBookInput({ ...book, genre: "FICTION" }), undefined);
  assert.ok(validateBookPhoto({ size: 40, type: "application/pdf" }));
  assert.ok(validateBookPhoto({ size: 6 * 1024 * 1024, type: "image/png" }));
  assert.equal(validateBookPhoto({ size: 100, type: "image/webp" }), undefined);
});
