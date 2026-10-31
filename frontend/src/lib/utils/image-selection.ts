export type SelectedImage = { file: File; url: string };
export function validateSelection(
  files: File[],
  maxFiles: number,
  validate: (file?: File) => string | undefined,
) {
  if (files.length > maxFiles)
    return `Choose up to ${maxFiles} image${maxFiles === 1 ? "" : "s"} for the remaining slots.`;
  for (const file of files) {
    const error = validate(file);
    if (error) return error;
  }
}
