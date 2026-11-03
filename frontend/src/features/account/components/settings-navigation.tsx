"use client";
import { useAuth } from "@/features/auth/auth-provider";
import { ButtonLink } from "@/components/ui/button";
export function SettingsNavigation() {
  const { user } = useAuth();
  return (
    <nav aria-label="Account settings" className="mb-6 flex flex-wrap gap-2">
      <ButtonLink variant="secondary" href="/settings/account">
        Account security
      </ButtonLink>
      <ButtonLink variant="secondary" href="/settings/sessions">
        Signed-in devices
      </ButtonLink>
      {!user?.is_admin && (
      <ButtonLink variant="secondary" href="/profile">
        Back
      </ButtonLink>
      )}
    </nav>
  );
}
