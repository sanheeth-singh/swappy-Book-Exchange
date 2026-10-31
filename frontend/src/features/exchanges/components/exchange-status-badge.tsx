import { Badge } from "@/components/ui/badge";
import { exchangeStatuses } from "@/features/help/content";
import { exchangeStatusTones } from "../status";
import type { Exchange } from "../types";
export function ExchangeStatusBadge({
  status,
}: {
  status: Exchange["status"];
}) {
  return (
    <Badge className="exchange-status" tone={exchangeStatusTones[status]}>
      {exchangeStatuses[status].label}
    </Badge>
  );
}
