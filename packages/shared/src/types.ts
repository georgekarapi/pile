export type PlanStatus = "draft" | "pending_payment" | "live" | "paused" | "blocked";
export type FundingState =
  | "invoice_paid"
  | "crediting"
  | "credited"
  | "swapping"
  | "depositing"
  | "borrowing"
  | "complete"
  | "blocked_demo_cap"
  | "needs_attention";

export type BasketWeight = { symbol: string; mint: string; bps: number };

export type Plan = {
  id: string;
  userId: string;
  amountUsd: 30 | 50 | 100;
  interval: "week";
  weights: BasketWeight[];
  stripePriceId: string;
  stripeSubscriptionId?: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseLeg = {
  mint: string;
  symbol: string;
  inputUsdcAtomic: string;
  outputAtomic?: string;
  swapSignature?: string;
  status: "pending" | "swapped" | "failed";
  error?: string;
};

export type FundingCycle = {
  id: string;
  planId: string;
  userId: string;
  expectedUsd: number;
  state: FundingState;
  creditSignature?: string;
  creditUsdcAtomic?: string;
  legs: PurchaseLeg[];
  depositSignatures: string[];
  borrowSignature?: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type HealthStatus = "healthy" | "warning" | "critical" | "stale";
export type Health = {
  collateralUsd: number;
  debtUsd: number;
  walletUsdcUsd: number;
  currentLtvBps: number;
  effectiveMaxLtvBps: number;
  liquidationLtvBps: number;
  safeCeilingLtvBps: number;
  operatingLtvBps: number;
  desiredDebtUsd: number;
  additionalBorrowUsd: number;
  cardAvailableUsd: number;
  requiredRepayReserveUsd: number;
  status: HealthStatus;
  observedAt: string;
};

export type CardRecord = {
  userId: string;
  bridgeCustomerId: string;
  bridgeCardAccountId?: string;
  stripeCardId?: string;
  last4?: string;
  status: "not_issued" | "active" | "frozen" | "sandbox";
  mode: "bridge_sandbox" | "bridge_live";
  updatedAt: string;
};
