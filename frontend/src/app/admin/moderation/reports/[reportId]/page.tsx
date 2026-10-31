import { ReportScreen } from "@/features/moderation/screens/report-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  return <ReportScreen id={reportId} />;
}
