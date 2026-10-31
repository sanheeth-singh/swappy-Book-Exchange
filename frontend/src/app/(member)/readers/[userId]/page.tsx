import { ReaderScreen } from "@/features/reviews/screens/reader-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <ReaderScreen id={userId} />;
}
