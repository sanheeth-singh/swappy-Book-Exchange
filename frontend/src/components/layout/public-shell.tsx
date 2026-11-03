import { DiscoveryLink } from "@/components/ui/discovery-link";
import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "./header";
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <footer className="container mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border py-7 text-sm text-muted">
        <p>Swappy · A new chapter for every book.</p>
        <nav aria-label="Footer navigation" className="flex gap-4">
          <DiscoveryLink variant="ghost" />
          <Link className="nav-link" href="/help">
            Help
          </Link>
          <Link className="nav-link" href="/developer">Developer</Link>
        </nav>
      </footer>
    </>
  );
}
