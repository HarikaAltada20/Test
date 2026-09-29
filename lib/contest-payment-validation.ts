import { calculateTotalAmount } from "@/lib/contest-utils";
import {
  getChargeableBudgetCents,
  type ContestForChargeableBudget,
} from "@/lib/contest-chargeable-budget";
import type { PaymentDetails } from "@/lib/payment-utils";
import {
  getPlanFeaturesFromProductId,
  getUserPlanFeatures,
  getUserPlanFeaturesAsAdmin,
} from "@/lib/subscription-utils";
import type { SubscriptionPlan } from "./subscription-types";

export { getChargeableBudgetCents };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTEST_CREATE_RETURN_PATH = "/dashboard/contests/create";
const CONTEST_EDIT_RETURN_PATH_PATTERN =
  /^\/dashboard\/contests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/edit$/i;

export type ContestForPaymentValidation = ContestForChargeableBudget & {
  payment_details?: PaymentDetails | string | null;
  subscription_info_of_user?: unknown;
};

export type ExpectedContestPayment = {
  prizePoolInCents: number;
  commissionPercentage: number;
  totalAmountInCents: number;
  changeType?: "increase" | "decrease";
};

export type ResolveExpectedContestPaymentOptions = {
  isIncrease?: boolean;
  isDecrease?: boolean;
  /** Use admin client when resolving plan (pay-as-brand / cross-user). */
  planLookup?: "session" | "admin";
};

async function resolvePlanFeaturesForPayment(
  contest: ContestForPaymentValidation,
  userId: string,
  planLookup: "session" | "admin" = "session",
): Promise<SubscriptionPlan["features"] | null> {
  if (planLookup === "admin") {
    return getUserPlanFeaturesAsAdmin(userId);
  }

  const snapshotProductId = (
    contest.subscription_info_of_user as { product_id?: string } | null
  )?.product_id;
  const fromSnapshot = getPlanFeaturesFromProductId(snapshotProductId);
  if (fromSnapshot) return fromSnapshot;

  return getUserPlanFeatures(userId);
}

export class ContestPaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContestPaymentValidationError";
  }
}

function parsePaymentDetails(
  raw: PaymentDetails | string | null | undefined,
): PaymentDetails | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as PaymentDetails;
    } catch {
      return null;
    }
  }
  return raw;
}

function getCommissionForBudgetChange(
  paymentDetails: PaymentDetails | null,
): number | null {
  if (paymentDetails?.commission_percentage != null) {
    return paymentDetails.commission_percentage;
  }
  return null;
}

export async function resolveExpectedContestPayment(
  contest: ContestForPaymentValidation,
  userId: string,
  options: ResolveExpectedContestPaymentOptions = {},
): Promise<ExpectedContestPayment> {
  const { isIncrease = false, isDecrease = false } = options;

  if (isIncrease && isDecrease) {
    throw new ContestPaymentValidationError(
      "Cannot process both budget increase and decrease",
    );
  }

  if (isDecrease) {
    throw new ContestPaymentValidationError(
      "Budget decreases must use the refund flow, not payment",
    );
  }

  const paymentDetails = parsePaymentDetails(contest.payment_details);
  const isInitialPayment =
    !paymentDetails || paymentDetails.payment_status !== "completed";
  const newBudgetCents = getChargeableBudgetCents(contest);

  if (isInitialPayment) {
    if (newBudgetCents <= 0) {
      throw new ContestPaymentValidationError(
        "Campaign budget is missing or invalid",
      );
    }

    const planFeatures = await resolvePlanFeaturesForPayment(
      contest,
      userId,
      options.planLookup ?? "session",
    );
    if (!planFeatures) {
      throw new ContestPaymentValidationError(
        "Failed to resolve subscription plan for payment",
      );
    }

    const commissionPercentage = planFeatures.commissionPercentage;
    return {
      prizePoolInCents: newBudgetCents,
      commissionPercentage,
      totalAmountInCents: calculateTotalAmount(
        newBudgetCents,
        commissionPercentage,
      ),
    };
  }

  if (!isIncrease) {
    throw new ContestPaymentValidationError(
      "Campaign payment is already completed",
    );
  }

  const oldBudgetCents = paymentDetails?.total_prize_pool ?? 0;
  const deltaCents = newBudgetCents - oldBudgetCents;

  if (deltaCents <= 0) {
    throw new ContestPaymentValidationError(
      "No budget increase detected for this campaign",
    );
  }

  const storedCommission = getCommissionForBudgetChange(paymentDetails);
  if (storedCommission == null) {
    throw new ContestPaymentValidationError(
      "Original commission rate not found for budget increase",
    );
  }

  return {
    prizePoolInCents: deltaCents,
    commissionPercentage: storedCommission,
    totalAmountInCents: calculateTotalAmount(deltaCents, storedCommission),
    changeType: "increase",
  };
}

/** Only allow in-app contest create/edit return paths (prevents open redirects). */
export function getSafeContestPaymentReturnPath(
  returnPath: string | null | undefined,
): string | null {
  if (!returnPath || typeof returnPath !== "string") return null;

  const trimmed = returnPath.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("..")) return null;

  let pathname: string;
  try {
    pathname = new URL(trimmed, "http://localhost").pathname;
  } catch {
    return null;
  }

  if (pathname === CONTEST_CREATE_RETURN_PATH) {
    return CONTEST_CREATE_RETURN_PATH;
  }

  if (CONTEST_EDIT_RETURN_PATH_PATTERN.test(pathname)) {
    const contestId = pathname.split("/")[3];
    if (!UUID_REGEX.test(contestId)) return null;
    return pathname;
  }

  return null;
}

export function assertClientPaymentMatchesExpected(
  clientAmountDollars: number | undefined,
  clientCommissionPercentage: number | undefined,
  expected: ExpectedContestPayment,
): void {
  if (clientAmountDollars != null) {
    const clientTotalCents = Math.round(clientAmountDollars * 100);
    if (Math.abs(clientTotalCents - expected.totalAmountInCents) > 1) {
      console.warn(
        "[contest-payment-validation] Client amount mismatch:",
        clientTotalCents,
        "expected",
        expected.totalAmountInCents,
      );
    }
  }

  if (clientCommissionPercentage != null) {
    if (
      Math.abs(clientCommissionPercentage - expected.commissionPercentage) > 0.001
    ) {
      console.warn(
        "[contest-payment-validation] Client commission mismatch:",
        clientCommissionPercentage,
        "expected",
        expected.commissionPercentage,
      );
    }
  }
}

const BUDGET_MATCH_TOLERANCE_CENTS = 1;

/** Returns budget delta when chargeable contest budget does not match completed payment. */
export function getContestBudgetPaymentMismatch(
  contest: ContestForPaymentValidation,
): { chargeableCents: number; paidCents: number; deltaCents: number } | null {
  const paymentDetails = parsePaymentDetails(contest.payment_details);
  if (!paymentDetails || paymentDetails.payment_status !== "completed") {
    return null;
  }

  const paidCents = paymentDetails.total_prize_pool ?? 0;
  const chargeableCents = getChargeableBudgetCents(contest);
  const deltaCents = chargeableCents - paidCents;

  if (Math.abs(deltaCents) <= BUDGET_MATCH_TOLERANCE_CENTS) {
    return null;
  }

  return { chargeableCents, paidCents, deltaCents };
}
