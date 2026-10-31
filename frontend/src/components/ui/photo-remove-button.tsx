import { X } from "lucide-react";
import { Button } from "./button";
export function PhotoRemoveButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="secondary"
      className="photo-remove"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title="Delete"
      data-tooltip="Delete"
    >
      <X size={18} aria-hidden="true" />
    </Button>
  );
}
