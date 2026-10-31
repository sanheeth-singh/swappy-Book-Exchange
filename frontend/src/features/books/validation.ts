import type { BookInput } from "./types";
export function validateBookInput(data: BookInput): string | undefined {
  if (!data.title.trim() || !data.author.trim() || !data.description.trim())
    return "Title, author and description cannot be blank.";
  if (
    data.title.length > 200 ||
    data.author.length > 200 ||
    data.description.length > 2000 ||
    data.condition_notes.length > 1000
  )
    return "One of the book fields is too long.";
  if (!data.genre) return "Choose a genre.";
}
