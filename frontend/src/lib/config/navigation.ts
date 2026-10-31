import { routes } from "./routes";
export const publicNavigation = [
  { label: "Explore books", href: routes.explore },
  { label: "Help", href: routes.help },
];
export const memberNavigation = [
  { label: "Discover", href: "/books" },
  { label: "My Books", href: "/my-books" },
  { label: "Exchanges", href: "/exchanges" },
  { label: "Messages", href: "/messages" },
  { label: "Profile", href: "/profile" },
];
export const adminNavigation = [
  { label: "Overview", href: "/admin" },
  { label: "Verification queue", href: "/admin/memberships" },
  { label: "Colleges & campuses", href: "/admin/directory" },
  { label: "Exchange issues", href: "/admin/issues" },
  { label: "Safety & moderation", href: "/admin/moderation" },
  { label: "Account settings", href: "/settings/account" },
];
