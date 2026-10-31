"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "./header";
import { adminNavigation } from "@/lib/config/navigation";
export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <div className="container admin-layout py-6">
        <aside className="admin-sidebar">
          <p className="eyebrow mb-4">Administration</p>
          <nav aria-label="Administration">
            {adminNavigation.map((item) => (
              <Link
                className="nav-link"
                key={item.href}
                href={item.href}
                aria-current={path === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </>
  );
}
