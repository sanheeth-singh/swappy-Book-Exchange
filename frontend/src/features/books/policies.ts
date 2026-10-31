import type { Book } from "./types";
export function canEditListing(book: Book, userId: string) {
  return (
    book.owner_id === userId &&
    !book.is_archived &&
    !book.is_hidden &&
    !book.is_reserved
  );
}
export function validateBookPhoto(file?: Pick<File, "size" | "type">) {
  if (!file) return "Choose a photo.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Use a JPEG, PNG or WebP photo.";
  if (!file.size || file.size > 5 * 1024 * 1024)
    return "Use a photo up to 5 MiB.";
}
export function listingState(book: Book) {
  return book.is_hidden
    ? "Hidden"
    : book.is_archived
      ? "Archived"
      : book.is_reserved
        ? "Reserved"
        : "Available";
}
