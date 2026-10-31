import { ReportFormScreen } from "@/features/reports/screens/report-form-screen";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const params = await searchParams;
  return <ReportFormScreen type={params.type ?? ""} id={params.id ?? ""} />;
}
