"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/features/auth/auth-provider";
import { profileSchema } from "@/features/auth/schemas";
import { getCampuses, saveProfile } from "../api";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
import { useOverlayStore } from "@/stores/overlay-store";
import { useToastStore } from "@/stores/toast-store";

export function ProfileScreen() {
  const { user } = useAuth();
  return user ? <ProfileForm key={user.id + (user.campus_id ?? "")} /> : null;
}

function ProfileForm() {
  const auth = useAuth();
  const user = auth.user!;
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string>();

  const directory = useQuery({
    queryKey: ["campuses", q, offset],
    queryFn: () => getCampuses(q, offset),
  });

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: user.display_name ?? "",
      campus_id: user.campus_id ?? "",
    },
  });

  const selectedCampus = useWatch({ control: form.control, name: "campus_id" });

  async function save(data: { display_name: string; campus_id: string }) {
    setError(undefined);
    try {
      const updated = await saveProfile(data);
      client.setQueryData(["auth", "me"], updated);
      await client.invalidateQueries({ queryKey: ["membership"] });
      useToastStore.getState().show("Profile saved.");
    } catch (failure) {
      const message =
        failure instanceof Error
          ? failure.message
          : "Profile could not be saved.";
      setError(message);
      throw failure;
    }
  }

  const submit = form.handleSubmit(async (data) => {
    if (user.campus_id && data.campus_id !== user.campus_id) {
      useOverlayStore.getState().openConfirmation({
        title: "Change your campus?",
        description:
          "This resets your verification, archives your listings and withdraws pending proposals. Unresolved accepted exchanges must be resolved first.",
        confirmLabel: "Change campus",
        destructive: true,
        onConfirm: () => save(data),
      });
    } else {
      try {
        await save(data);
      } catch {}
    }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-4">
          <p className="eyebrow">Your campus identity</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink variant="secondary" href="/settings/profile">
              Reader details
            </ButtonLink>
            <ButtonLink variant="secondary" href="/settings/account">
              Account settings
            </ButtonLink>
            <ButtonLink variant="secondary" href="/notifications">
              Notifications
            </ButtonLink>
            <ButtonLink variant="secondary" href="/safety">
              Safety
            </ButtonLink>
            <ButtonLink variant="secondary" href={`/readers/${user.id}`}>
              My reputation
            </ButtonLink>
          </div>
          <div>
            <h1 className="mt-4 text-4xl font-bold text-slate-800">Set up your profile.</h1>
            <p className="mt-2 text-lg font-medium text-slate-500">{user.email}</p>
          </div>
        </div>
        <ButtonLink href="/membership" variant="secondary" className="shrink-0">
          Campus verification
        </ButtonLink>
      </header>

      <Card className="p-6 md:p-8 max-w-2xl">
        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-2">
            <label htmlFor="name" className="font-semibold text-slate-700 ml-1">Display name</label>
            <Input
              id="name"
              maxLength={80}
              placeholder="How others will see you"
              {...form.register("display_name")}
            />
            <FormError message={form.formState.errors.display_name?.message} />
          </div>

          <div className="space-y-2">
            <label htmlFor="campus-search" className="font-semibold text-slate-700 ml-1">Find your campus</label>
            <div className="search-toolbar flex items-center gap-3">
              <Input
                id="campus-search"
                type="search"
                placeholder="College, campus or city"
                onChange={(event) => {
                  setQ(event.target.value);
                  setOffset(0);
                }}
                value={q}
              />
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider shrink-0">Search</span>
            </div>
          </div>

          {directory.isError ? (
            <div className="p-4 rounded-2xl bg-red-50 shadow-inner">
              <ErrorState
                message={directory.error.message}
                retry={() => {
                  void directory.refetch();
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="campus" className="font-semibold text-slate-700 ml-1">Campus</label>
              <Select
                id="campus"
                {...form.register("campus_id")}
                value={selectedCampus}
                disabled={directory.isPending}
              >
                <option value="">
                  {directory.isPending
                    ? "Loading campuses…"
                    : "Choose a campus"}
                </option>
                {selectedCampus &&
                  !directory.data?.some(
                    (campus) => campus.id === selectedCampus,
                  ) && (
                    <option value={selectedCampus}>
                      {selectedCampus === user.campus_id
                        ? "Keep current campus"
                        : "Selected campus (outside these search results)"}
                    </option>
                  )}
                {directory.data?.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.college_name} · {campus.name} · {campus.city}
                  </option>
                ))}
              </Select>
              <FormError message={form.formState.errors.campus_id?.message} />
              
              {directory.data?.length === 0 && (
                <p className="mt-3 text-sm font-medium text-slate-500 bg-slate-50 p-4 rounded-xl shadow-inner">
                  No matching active campus. Try another search or contact your
                  campus administrator.
                </p>
              )}
              
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="ghost"
                  disabled={!offset}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous campuses
                </Button>
                <Button
                  variant="ghost"
                  disabled={directory.data?.length !== 50}
                  onClick={() => setOffset(offset + 50)}
                >
                  More campuses
                </Button>
              </div>
            </div>
          )}
          
          <FormError message={error} />
          
          <div className="pt-4">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || directory.isPending}
              className="w-full md:w-auto px-8"
            >
              {form.formState.isSubmitting ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}