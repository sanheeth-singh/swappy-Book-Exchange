export function discoveryLink(user?: { is_admin: boolean } | null) {
  return !user
    ? { label: "Explore books", href: "/explore" }
    : user.is_admin
      ? { label: "Administration", href: "/admin" }
      : { label: "Discover", href: "/books" };
}
