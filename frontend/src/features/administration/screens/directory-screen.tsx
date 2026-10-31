"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type Schema } from "../api";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
export function DirectoryScreen() {
  const client = useQueryClient();
  const [kind, setKind] = useState<"colleges" | "campuses">("colleges");
  const [offset, setOffset] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [selected, setSelected] = useState<
    Schema["CollegeResponse"] | Schema["AdminCampusResponse"]
  >();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const entries = useQuery<
    Array<Schema["CollegeResponse"] | Schema["AdminCampusResponse"]>
  >({
    queryKey: ["admin", "directory", kind, offset],
    queryFn: () =>
      kind === "colleges"
        ? adminApi.colleges(offset)
        : adminApi.campuses(offset),
  });
  const audit = useQuery({
    queryKey: ["admin", "audit", auditOffset],
    queryFn: () => adminApi.audit(auditOffset),
  });
  const impact = useQuery({
    queryKey: ["admin", "impact", kind, selected?.id],
    queryFn: () => adminApi.impact(kind, selected!.id),
    enabled: !!selected,
  });
  async function act(work: () => Promise<unknown>) {
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await work();
      await client.invalidateQueries({ queryKey: ["admin"] });
      setSelected(undefined);
      setNotice("Directory change recorded.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <p className="eyebrow">Stable IDs. Audited changes.</p>
      <h1 className="mt-3 text-4xl">Colleges & campuses.</h1>
      <div className="my-5 flex gap-3">
        {(["colleges", "campuses"] as const).map((value) => (
          <Button
            key={value}
            variant={kind === value ? "primary" : "secondary"}
            onClick={() => {
              setKind(value);
              setOffset(0);
              setSelected(undefined);
            }}
          >
            {value === "colleges" ? "Colleges" : "Campuses"}
          </Button>
        ))}
      </div>
      <FormError message={error} />
      {notice && (
        <p role="status" className="help-note">
          {notice}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-xl">
            {kind === "colleges" ? "College directory" : "Campus directory"}
          </h2>
          {entries.isPending ? (
            <p role="status">Loading directory…</p>
          ) : entries.isError ? (
            <ErrorState
              message={entries.error.message}
              retry={() => {
                void entries.refetch();
              }}
            />
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {entries.data.map((item) => (
                  <div key={item.id} className="border-b border-border pb-3">
                    <h3>{item.name}</h3>
                    {"city" in item && (
                      <p className="text-sm text-muted">
                        {item.college_name} · {item.city}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {item.is_active ? "Active" : "Inactive"}
                      {"effective_is_active" in item &&
                      !item.effective_is_active &&
                      item.is_active
                        ? " · college is inactive"
                        : ""}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted">
                      ID: {item.id}
                    </p>
                    <Button variant="ghost" onClick={() => setSelected(item)}>
                      Manage
                    </Button>
                  </div>
                ))}
              </div>
              {!entries.data.length && (
                <p className="mt-4 text-muted">No entries on this page.</p>
              )}
              <Pagination
                offset={offset}
                pageSize={20}
                hasMore={entries.data.length === 20}
                onChange={setOffset}
              />
            </>
          )}
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-xl">
              {selected ? "Edit selected entry" : "Create an entry"}
            </h2>
            <form
              key={kind + (selected?.id ?? "new")}
              className="mt-4 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const name = String(data.get("name")).trim();
                const reason = String(data.get("reason")).trim();
                if (kind === "colleges")
                  void act(() =>
                    selected
                      ? adminApi.editCollege(selected.id, { name, reason })
                      : adminApi.createCollege({ name, reason }),
                  );
                else {
                  const city = String(data.get("city")).trim();
                  if (selected)
                    void act(() =>
                      adminApi.editCampus(selected.id, { name, city, reason }),
                    );
                  else {
                    const college_id = String(data.get("college_id")).trim();
                    void act(() =>
                      adminApi.createCampus({ name, city, reason, college_id }),
                    );
                  }
                }
              }}
            >
              <label>
                Name
                <Input
                  name="name"
                  defaultValue={selected?.name}
                  required
                  maxLength={200}
                />
              </label>
              {kind === "campuses" && (
                <>
                  <label>
                    City
                    <Input
                      name="city"
                      defaultValue={
                        selected && "city" in selected ? selected.city : ""
                      }
                      required
                      maxLength={120}
                    />
                  </label>
                  {!selected && (
                    <label>
                      College ID
                      <Input
                        name="college_id"
                        required
                        placeholder="Copy an ID from the Colleges tab"
                      />
                    </label>
                  )}
                </>
              )}
              <label>
                Reason
                <Textarea
                  name="reason"
                  minLength={10}
                  maxLength={1000}
                  required
                />
              </label>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : selected
                    ? "Save update"
                    : "Create entry"}
              </Button>
              {selected && (
                <Button variant="ghost" onClick={() => setSelected(undefined)}>
                  Cancel selection
                </Button>
              )}
            </form>
          </Card>
          {selected && (
            <Card className="p-5">
              <h2 className="text-xl">
                {selected.is_active ? "Deactivate" : "Activate"} {selected.name}
              </h2>
              <p className="mt-3 text-sm text-muted">
                Deactivation stops new activity while preserving records and
                existing handover/support paths. Recheck impact before
                submitting.
              </p>
              {impact.isPending ? (
                <p role="status">Checking impact…</p>
              ) : impact.isError ? (
                <ErrorState
                  message={impact.error.message}
                  retry={() => {
                    void impact.refetch();
                  }}
                />
              ) : (
                impact.data && (
                  <dl className="impact-grid mt-4">
                    {Object.entries(impact.data)
                      .filter(([key]) => !key.endsWith("_id"))
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{key.replaceAll("_", " ")}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                  </dl>
                )
              )}
              <form
                key={selected.id}
                className="mt-4 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  const current_password = String(data.get("password"));
                  const reason = String(data.get("reason")).trim();
                  void act(async () => {
                    try {
                      await adminApi.status(kind, selected.id, {
                        is_active: !selected.is_active,
                        current_password,
                        reason,
                      });
                    } finally {
                      form.reset();
                    }
                  });
                }}
              >
                <label>
                  Reason
                  <Textarea
                    name="reason"
                    minLength={10}
                    maxLength={1000}
                    required
                  />
                </label>
                <label>
                  Confirm your password
                  <Input
                    type="password"
                    autoComplete="current-password"
                    name="password"
                    required
                    maxLength={128}
                  />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" required className="mt-1" />I reviewed
                  the impact and intend to change this entry’s status.
                </label>
                <Button
                  variant={selected.is_active ? "danger" : "primary"}
                  type="submit"
                  disabled={pending || !impact.data || impact.isError}
                >
                  {selected.is_active ? "Deactivate entry" : "Activate entry"}
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
      <section className="mt-8">
        <h2 className="text-2xl">Audit history</h2>
        {audit.isPending ? (
          <p role="status">Loading audit…</p>
        ) : audit.isError ? (
          <ErrorState
            message={audit.error.message}
            retry={() => {
              void audit.refetch();
            }}
          />
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {audit.data.map((item) => (
                <Card key={item.id} className="p-4">
                  <h3 className="text-sm">
                    {item.action.replaceAll("_", " ")}
                  </h3>
                  <p className="mt-2 text-sm">{item.reason}</p>
                  <p className="mt-2 text-xs text-muted">
                    {new Date(item.created_at).toLocaleString()} · {item.source}
                  </p>
                </Card>
              ))}
            </div>
            <Pagination
              offset={auditOffset}
              pageSize={20}
              hasMore={audit.data.length === 20}
              onChange={setAuditOffset}
            />
          </>
        )}
      </section>
    </div>
  );
}
