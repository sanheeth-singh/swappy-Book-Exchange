"use client";
import { useAuth } from "@/features/auth/auth-provider";
import { ButtonLink } from "./button";
import { discoveryLink } from "@/lib/config/discovery";
export function DiscoveryLink({
  variant = "primary",
}: {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { user } = useAuth();
  const link = discoveryLink(user);
  return (
    <ButtonLink href={link.href} variant={variant}>
      {link.label}
    </ButtonLink>
  );
}
