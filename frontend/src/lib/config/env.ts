// Browser requests must stay on the frontend origin so HttpOnly refresh cookies
// work on localhost, mobile browsers and production. API_ORIGIN is server-only.
// Legacy absolute NEXT_PUBLIC_API_URL values no longer bypass this boundary.
export const env = { apiUrl: "/api/v1" } as const;
