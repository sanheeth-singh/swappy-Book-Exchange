import { ReportDetailScreen } from "@/features/reports/screens/report-detail-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  return <ReportDetailScreen id={reportId} />;
}
