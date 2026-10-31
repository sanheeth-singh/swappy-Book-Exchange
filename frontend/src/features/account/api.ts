import { protectedRequest, sessionMutation } from "@/features/auth/session";
import type { components } from "@/lib/api/generated/schema";
type S = components["schemas"];
export const accountApi = {
  sessions: (offset = 0) =>
    protectedRequest<S["SessionResponse"][]>({
      url: "/auth/sessions",
      params: { limit: 20, offset },
    }),
  revoke: (id: string) =>
    sessionMutation<void>({
      method: "POST",
      url: `/auth/sessions/${id}/revoke`,
    }),
  logoutAll: () =>
    sessionMutation<void>({ method: "POST", url: "/auth/logout-all" }),
  eligibility: () =>
    protectedRequest<S["DeactivationEligibility"]>({
      url: "/users/me/deactivation",
    }),
  password: (data: S["PasswordChangeInput"]) =>
    sessionMutation<void>({ method: "POST", url: "/users/me/password", data }),
  deactivate: (data: S["DeactivationInput"]) =>
    sessionMutation<S["DeactivationResponse"]>({
      method: "POST",
      url: "/users/me/deactivate",
      data,
    }),
};
