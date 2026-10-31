import type { ReactNode } from "react";
import { Header } from "./header";
import { MobileNavigation } from "./mobile-navigation";
// Layout only. Authentication and eligibility guards are supplied in Stage 2.
export function MemberShell({ children }: { children: ReactNode }) { return <><a href="#main" className="skip-link">Skip to content</a><Header /><main id="main" className="container pb-32 pt-8 md:pb-8">{children}</main><MobileNavigation /></>; }
