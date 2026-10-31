"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { detailsApi, readingInterests } from "../details-api";
import { SettingsNavigation } from "@/features/account/components/settings-navigation";
import { ReaderAvatar } from "@/components/ui/reader-avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/feedback/error-state";
import { FormError } from "@/components/feedback/form-error";
import type { components } from "@/lib/api/generated/schema";

export function ReaderDetailsScreen() {
  const profile = useQuery({
    queryKey: ["profile", "own"],
    queryFn: detailsApi.own,
  });
  const avatars = useQuery({
    queryKey: ["profile", "avatars"],
    queryFn: detailsApi.avatars,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      <SettingsNavigation />
      
      <header className="space-y-3">
        <h1 className="text-4xl font-bold text-slate-800">Your reader details</h1>
        <p className="text-lg text-slate-500 font-medium">
          Introduce yourself to other readers. Campus selection and verification
          are managed separately.
        </p>
      </header>

      {profile.isPending || avatars.isPending ? (
        <div className="card p-8 flex justify-center items-center min-h-[200px]">
          <p role="status" className="text-slate-500 font-medium animate-pulse">Loading reader details…</p>
        </div>
      ) : profile.isError || avatars.isError ? (
        <div className="card p-8 bg-red-50">
          <ErrorState
            message={
              profile.error?.message ??
              avatars.error?.message ??
              "Profile unavailable."
            }
            retry={() => {
              void profile.refetch();
              void avatars.refetch();
            }}
          />
        </div>
      ) : (
        <DetailsForm
          key={profile.data!.id}
          profile={profile.data!}
          avatars={avatars.data!}
        />
      )}
      
      <div className="pt-4">
        <ButtonLink variant="secondary" href="/profile">
          Campus profile and verification
        </ButtonLink>
      </div>
    </div>
  );
}

function DetailsForm({
  profile,
  avatars,
}: {
  profile: components["schemas"]["PublicProfile"];
  avatars: components["schemas"]["AvatarResponse"][];
}) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  return (
    <form
      className="card space-y-8 p-6 md:p-10"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setPending(true);
        setError(undefined);
        setNotice(undefined);
        try {
          const user = await detailsApi.update({
            display_name: String(data.get("display_name")).trim(),
            bio: String(data.get("bio")).trim() || null,
            reading_interests: readingInterests(String(data.get("interests"))),
            avatar_id: String(data.get("avatar_id")),
          });
          client.setQueryData(["auth", "me"], user);
          await Promise.all([
            client.invalidateQueries({ queryKey: ["profile", "own"] }),
            client.invalidateQueries({ queryKey: ["reader", profile.id] }),
          ]);
          setNotice("Reader details saved.");
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Profile could not be updated.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-6">
        <label className="block space-y-2">
          <span className="font-semibold text-slate-700 ml-1">Display name</span>
          <Input
            name="display_name"
            defaultValue={profile.display_name ?? ""}
            required
            minLength={1}
            maxLength={80}
          />
        </label>

        <label className="block space-y-2">
          <span className="font-semibold text-slate-700 ml-1">Bio</span>
          <Textarea
            name="bio"
            defaultValue={profile.bio ?? ""}
            maxLength={300}
            rows={4}
            className="resize-none"
          />
        </label>

        <div className="space-y-2">
          <label className="block space-y-2">
            <span className="font-semibold text-slate-700 ml-1">Reading interests</span>
            <Input
              name="interests"
              defaultValue={profile.reading_interests.join(", ")}
              aria-describedby="interests-help"
            />
          </label>
          <p id="interests-help" className="text-xs font-medium text-slate-400 ml-1">
            Separate up to eight interests with commas. Each can contain up to 40 characters.
          </p>
        </div>
      </div>

      <fieldset className="p-6 rounded-2xl bg-[#f7efe5] shadow-inner">
        <legend className="mb-4 font-semibold text-slate-800 text-lg">Choose your avatar</legend>
        <div className="avatar-options">
          {avatars.map((avatar) => (
            <label key={avatar.id} className="avatar-option">
              <input
                type="radio"
                name="avatar_id"
                value={avatar.id}
                defaultChecked={avatar.id === profile.avatar_id}
                required
                className="sr-only"
              />
              <ReaderAvatar url={avatar.url} name={avatar.name} size={64} />
              <span className="text-sm font-semibold text-slate-600 mt-2">{avatar.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormError message={error} />
      {notice && (
        <p role="status" className="help-note">
          {notice}
        </p>
      )}
      
      <div className="pt-2">
        <Button type="submit" disabled={pending} className="px-8">
          {pending ? "Saving…" : "Save reader details"}
        </Button>
      </div>
    </form>
  );
}