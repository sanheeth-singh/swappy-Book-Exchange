import { MessagesScreen } from "@/features/chat/screens/messages-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ exchangeId: string }>;
}) {
  const { exchangeId } = await params;
  return <MessagesScreen id={exchangeId} />;
}
