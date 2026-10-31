import { protectedRequest } from "@/features/auth/session";
import type { components } from "@/lib/api/generated/schema";
export type Schema = components["schemas"];
export const adminApi = {
  queue: () =>
    protectedRequest<Schema["ReviewQueueResponse"][]>({
      url: "/membership/submissions",
    }),
  proof: (id: string) =>
    protectedRequest<Blob>({
      url: `/membership/submissions/${id}/document`,
      responseType: "blob",
    }),
  review: (
    id: string,
    data: Schema["app__modules__colleges__schemas__ReviewInput"],
  ) =>
    protectedRequest({
      method: "POST",
      url: `/membership/submissions/${id}/review`,
      data,
    }),
  colleges: (offset = 0) =>
    protectedRequest<Schema["CollegeResponse"][]>({
      url: "/admin/colleges",
      params: { offset, limit: 20 },
    }),
  campuses: (offset = 0) =>
    protectedRequest<Schema["AdminCampusResponse"][]>({
      url: "/admin/campuses",
      params: { offset, limit: 20 },
    }),
  createCollege: (data: Schema["CollegeCreate"]) =>
    protectedRequest({ method: "POST", url: "/admin/colleges", data }),
  editCollege: (id: string, data: Schema["CollegeEdit"]) =>
    protectedRequest({ method: "PATCH", url: `/admin/colleges/${id}`, data }),
  createCampus: (data: Schema["CampusCreate"]) =>
    protectedRequest({ method: "POST", url: "/admin/campuses", data }),
  editCampus: (id: string, data: Schema["CampusEdit"]) =>
    protectedRequest({ method: "PATCH", url: `/admin/campuses/${id}`, data }),
  impact: (kind: "colleges" | "campuses", id: string) =>
    protectedRequest<Schema["DirectoryImpact"]>({
      url: `/admin/${kind}/${id}/impact`,
    }),
  status: (
    kind: "colleges" | "campuses",
    id: string,
    data: Schema["AvailabilityInput"],
  ) =>
    protectedRequest({
      method: "POST",
      url: `/admin/${kind}/${id}/status`,
      data,
    }),
  audit: (offset = 0) =>
    protectedRequest<Schema["DirectoryActionResponse"][]>({
      url: "/admin/directory/actions",
      params: { offset, limit: 20 },
    }),
  issues: (offset = 0) =>
    protectedRequest<Schema["IssueResponse"][]>({
      url: "/exchanges/admin/issues",
      params: { offset, limit: 20 },
    }),
  exchange: (id: string) =>
    protectedRequest<Schema["ExchangeResponse"]>({
      url: `/exchanges/admin/${id}`,
    }),
  resolve: (id: string, data: Schema["ResolutionInput"]) =>
    protectedRequest({ method: "POST", url: `/exchanges/${id}/resolve`, data }),
};
