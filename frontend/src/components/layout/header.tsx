"use client";
import { NotificationLink } from "@/features/notifications/components/notification-link";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { memberNavigation } from "@/lib/config/navigation";
import { discoveryLink } from "@/lib/config/discovery";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/stores/toast-store";
import { motion } from "framer-motion";

export function Header() {
  const pathname = usePathname();
  const auth = useAuth();
  const [pending, setPending] = useState(false);
  return (
    <header className="border-b border-border bg-background">
      <div className="container flex min-h-20 flex-wrap items-center justify-between gap-2 py-2">
        {/* <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight text-accent"
          aria-label="Swappy home"
        >
          <span className="text-foreground">b</span>swappy<span className="text-foreground">.</span>
        </Link> */}
    <Link href="/" aria-label="bSwappy home">
      <motion.div 
        className="text-2xl font-extrabold tracking-tight flex items-baseline cursor-pointer"
        initial="rest"
        whileHover="hover"
        animate="rest"
      >
        {/* Left Slash */}
        <motion.span 
          variants={{ rest: { x: 0, opacity: 0.7 }, hover: { x: -3, opacity: 1 } }}
          className="font-mono font-bold text-slate-400"
        >
          /
        </motion.span>

        {/* The 'b' */}
        <motion.span 
          variants={{ rest: { rotate: 0 }, hover: { rotate: -8, scale: 1.05 } }}
          transition={{ type: "spring", stiffness: 300 }}
          className="font-serif italic font-bold text-orange-600"
        >
          b
        </motion.span>

        {/* Right Slash */}
        <motion.span 
          variants={{ rest: { x: 0, opacity: 0.7 }, hover: { x: 3, opacity: 1 } }}
          className="font-mono font-bold text-slate-400"
        >
          /
        </motion.span>

        {/* 'swappy' tied to light mode dark text */}
        <span className="text-2xl font-extrabold tracking-tight text-accent">swappy</span>

        {/* The Dot */}
        <motion.span 
          variants={{ rest: { y: 0 }, hover: { y: -3 } }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="text-orange-600 font-bold"
        >
          .
        </motion.span>
      </motion.div>
    </Link>



        <nav
          aria-label="Student navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {auth.user &&
            !auth.user.is_admin &&
            memberNavigation
              .filter((item) => item.href !== "/profile")
              .map((item) => (
                <Link
                  key={item.href}
                  className="nav-link"
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
        </nav>
        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center gap-1"
        >
          {!auth.user?.is_admin && (
            <Link
              href={discoveryLink(auth.user).href}
              className={
                auth.user && !auth.user.is_admin
                  ? "nav-link md:hidden"
                  : "nav-link"
              }
            >
              {discoveryLink(auth.user).label}
            </Link>
          )}
          <Link href="/help" className="nav-link">
            Help
          </Link>
          {auth.status === "authenticated" && auth.user ? (
            <>
              <NotificationLink />
              <Link
                href={auth.user?.is_admin ? "/admin" : "/profile"}
                className="nav-link"
              >
                {auth.user?.is_admin ? "Administration" : "Profile"}
              </Link>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  try {
                    await auth.signOut();
                  } catch (error) {
                    useToastStore
                      .getState()
                      .show(
                        error instanceof Error
                          ? error.message
                          : "Sign out failed.",
                        "error",
                      );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Link className="nav-link" href="/login">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
