"use client";
import { useAuth } from "@/features/auth/auth-provider";
import { ButtonLink } from "./button";
import { discoveryLink } from "@/lib/config/discovery";

export function DiscoveryLink({
  variant = "primary",
  className = "",
}: {
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const { user } = useAuth();
  const link = discoveryLink(user);
  
  // Base classes for the clay button if primary is chosen, otherwise fallback to standard variants
  const buttonStyle = variant === "primary" 
    ? `button-primary px-8 py-4 text-lg shadow-[6px_6px_12px_rgba(234,97,19,0.25),-4px_-4px_10px_rgba(255,255,255,0.8)] ${className}`
    : className;

  return (
    <ButtonLink href={link.href} variant={variant} className={buttonStyle}>
      {link.label}
    </ButtonLink>
  );
}