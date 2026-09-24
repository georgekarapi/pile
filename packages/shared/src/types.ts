export type PlanStatus = "draft" | "pending_payment" | "live" | "paused" | "blocked" | "cancelled";
export type FundingState =
  | "invoice_paid"
  | "crediting"
  | "credited"
  | "swapping"
  | "swaps_submitted"
  | "depositing"
  | "deposits_submitted"
  | "borrowing"
  | "borrow_submitted"
  | "complete"
  | "blocked_demo_cap"
  | "needs_attention";

export type MixId = "balanced" | "market" | "tech" | "prestocks";
export type BasketWeight = { symbol: string; mint: string; bps: number; name?: string; image?: string; markPrice?: number; impliedValuation?: number };
export type PlanOption = {
  id: MixId;
  title: string;
  detail: string;
  tag?: string;
  isPartner?: boolean;
  weights: BasketWeight[];
};
export type PlanRevision = { amountUsd: number; weights: BasketWeight[]; stripePriceId: string; effectiveAt: string };
export type PendingPlanChange = { key: string; amountUsd: number; weights: BasketWeight[]; expectedUpdatedAt: string; startedAt: string };

export type Plan = {
  id: string;
  userId: string;
  amountUsd: number;
  interval: "week";
  weights: BasketWeight[];
  stripePriceId?: string;
  activationKey?: string;
  priorRevisions?: PlanRevision[];
  pendingChange?: PendingPlanChange;
  lastChangeKey?: string;
  pendingPauseKey?: string;
  lastPauseKey?: string;
  pendingResumeKey?: string;
  lastResumeKey?: string;
  stripeSubscriptionId?: string;
  paymentIssue?: { invoiceId: string; kind: "failed" | "action_required"; occurredAt: string };
  lastPaidInvoiceId?: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseLeg = {
  mint: string;
  symbol: string;
  /** Immutable allocation captured when the paid invoice created this cycle. */
  bps?: number;
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
  /** Last durable step to resume after a retryable failure. */
  resumeState?: Exclude<FundingState, "needs_attention">;
  creditSignature?: string;
  creditUsdcAtomic?: string;
  legs: PurchaseLeg[];
  depositSignatures: string[];
  borrowSignature?: string;
  /** Provider event that caused this cycle. Used for reconciliation, never as a balance. */
  sourceEventId?: string;
  /** Exact fiat amount received by Stripe in minor currency units. */
  fiatAmountMinor?: number;
  fiatCurrency?: string;
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
