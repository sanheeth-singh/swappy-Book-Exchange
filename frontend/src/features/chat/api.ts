import { protectedRequest } from "@/features/auth/session";
import type { components } from "@/lib/api/generated/schema";
export type Message = components["schemas"]["MessageResponse"];
export type ChatPage = components["schemas"]["ChatPage"];
export type SendAttempt = components["schemas"]["MessageInput"];
export function createAttempt(body: string): SendAttempt {
  return { client_message_id: crypto.randomUUID(), body: body.trim() };
}
export function mergeMessages(pages: ChatPage[]): Message[] {
  return [
    ...new Map(
      pages.flatMap((page) => page.items).map((item) => [item.id, item]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);
}
export const chatApi = {
  messages: (id: string, before?: number) =>
    protectedRequest<ChatPage>({
      url: `/exchanges/${id}/chat/messages`,
      params: { limit: 30, before },
    }),
  send: (id: string, data: SendAttempt) =>
    protectedRequest<Message>({
      method: "POST",
      url: `/exchanges/${id}/chat/messages`,
      data,
    }),
  read: (id: string, through_message_id: string) =>
    protectedRequest({
      method: "POST",
      url: `/exchanges/${id}/chat/read`,
      data: { through_message_id },
    }),
};
