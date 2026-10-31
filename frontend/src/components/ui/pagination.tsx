import { Button } from "./button";
export function Pagination({
  offset,
  pageSize,
  hasMore,
  pending = false,
  onChange,
}: {
  offset: number;
  pageSize: number;
  hasMore: boolean;
  pending?: boolean;
  onChange: (offset: number) => void;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="mt-5 flex items-center justify-between gap-3"
    >
      <Button
        variant="secondary"
        disabled={offset === 0 || pending}
        onClick={() => onChange(Math.max(0, offset - pageSize))}
      >
        Previous
      </Button>
      <span className="text-sm text-muted">
        Page {Math.floor(offset / pageSize) + 1}
      </span>
      <Button
        variant="secondary"
        disabled={!hasMore || pending}
        onClick={() => onChange(offset + pageSize)}
      >
        Next
      </Button>
    </nav>
  );
}
