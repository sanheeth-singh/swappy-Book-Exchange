"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memberNavigation } from "@/lib/config/navigation";
// Mount only inside the authenticated member shell after Stage 2 supplies real routes.
export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav className="mobile-nav" aria-label="Member navigation">
      {memberNavigation.map((item) => (
        <Link
          className="nav-link min-w-0 px-0 text-xs"
          key={item.href}
          href={item.href}
          aria-current={
            pathname === item.href || pathname.startsWith(item.href + "/")
              ? "page"
              : undefined
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
