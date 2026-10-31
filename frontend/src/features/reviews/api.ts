import { protectedRequest } from "@/features/auth/session";
import type { components } from "@/lib/api/generated/schema";
type S = components["schemas"];
export const reviewsApi = {
  exchange: (id: string) =>
    protectedRequest<S["ExchangeReviews"]>({ url: `/exchanges/${id}/reviews` }),
  submit: (
    id: string,
    data: S["app__modules__reviews__schemas__ReviewInput"],
  ) =>
    protectedRequest<S["OwnReview"]>({
      method: "POST",
      url: `/exchanges/${id}/reviews`,
      data,
    }),
  reputation: (id: string) =>
    protectedRequest<S["Reputation"]>({ url: `/users/${id}/reputation` }),
  list: (id: string, before?: string) =>
    protectedRequest<S["ReviewPage"]>({
      url: `/users/${id}/reviews`,
      params: { limit: 20, before },
    }),
  profile: (id: string) =>
    protectedRequest<S["PublicProfile"]>({ url: `/users/${id}/profile` }),
};
