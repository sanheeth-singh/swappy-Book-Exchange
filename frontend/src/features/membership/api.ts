import { protectedRequest } from "@/features/auth/session";
import type { components } from "@/lib/api/generated/schema";
export type Membership = components["schemas"]["MembershipResponse"];
export function getMembership() { return protectedRequest<Membership>({ url: "/membership/me" }); }
export function submitProof(document: File) { const data = new FormData(); data.append("document", document); return protectedRequest<Membership>({ method: "POST", url: "/membership/submissions", data }); }
