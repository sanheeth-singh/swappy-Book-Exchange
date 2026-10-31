import type { AuditEntry } from "../types";
export function AuditTrail({ items }: { items: AuditEntry[] }) {
  return items.length ? (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="card space-y-2 p-4">
          <h3 className="capitalize">
            {item.action.toLowerCase().replaceAll("_", " ")}
          </h3>
          <p className="whitespace-pre-wrap break-words">{item.note}</p>
          <p className="break-all text-xs text-muted">
            Administrator: {item.actorId}
            {item.target && (
              <>
                <br />
                Target: {item.target}
              </>
            )}
            <br />
            {new Date(item.date).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  ) : (
    <p className="text-sm text-muted">No recorded actions.</p>
  );
}
