"use client";
import { ImagePicker } from "@/components/ui/image-picker";
import { validateBookPhoto } from "../policies";
export function PhotoUpload({
  onUpload,
  disabled = false,
  remainingSlots = 3,
}: {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  remainingSlots?: number;
}) {
  return (
    <ImagePicker
      maxFiles={remainingSlots}
      accept="image/jpeg,image/png,image/webp"
      validate={validateBookPhoto}
      onUpload={onUpload}
      disabled={disabled}
      label="Choose book photos"
      uploadLabel="Upload selected photos"
    />
  );
}
