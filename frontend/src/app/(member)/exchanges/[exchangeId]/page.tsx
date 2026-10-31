import { ExchangeDetailScreen } from "@/features/exchanges/screens/exchange-detail-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ exchangeId: string }>;
}) {
  const { exchangeId } = await params;
  return <ExchangeDetailScreen id={exchangeId} />;
}
