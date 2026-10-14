import { withdrawalPayout } from "@/lib/payout-fees";
import type { WithdrawalRequest } from "@/types/earnings";

/** "You receive ₹8,100.00" under a withdrawal amount, for requests that had a fee or pay in INR. */
export function WithdrawalReceiveNote({ request }: { request: WithdrawalRequest }) {
  const payout = withdrawalPayout(request);
  if (payout.feeCents <= 0 && payout.currency === "USD") return null;
  return (
    <span className="block text-xs text-muted-foreground">
      You receive {payout.receiveLabel}
      {request.payout_method_type_snapshot === "skydo" ? " (USD)" : ""}
    </span>
  );
}
