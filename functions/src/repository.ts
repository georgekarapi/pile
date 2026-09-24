import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import type { BasketWeight, CardRecord, FundingCycle, Plan } from "@pile/shared";

const db = () => getFirestore();
const now = () => new Date().toISOString();

export async function getPlan(planId: string): Promise<Plan | undefined> {
  const snap = await db().collection("plans").doc(planId).get();
  return snap.exists ? snap.data() as Plan : undefined;
}

export async function getActivePlan(userId: string): Promise<Plan | undefined> {
  const snap = await db().collection("plans").where("userId", "==", userId).where("status", "==", "live").limit(1).get();
  return snap.empty ? undefined : snap.docs[0].data() as Plan;
}

export async function getPausedPlan(userId: string): Promise<Plan | undefined> {
  const snap = await db().collection("plans").where("userId", "==", userId).where("status", "==", "paused").limit(1).get();
  return snap.empty ? undefined : snap.docs[0].data() as Plan;
}

/** Prefer the running plan over an abandoned draft; never use this for balances. */
export async function getCurrentPlan(userId: string): Promise<Plan | undefined> {
  const active = await getActivePlan(userId);
  if (active) return active;
  const paused = await getPausedPlan(userId);
  if (paused) return paused;
  const snap = await db().collection("plans").where("userId", "==", userId).orderBy("updatedAt", "desc").limit(1).get();
  return snap.empty ? undefined : snap.docs[0].data() as Plan;
}

export async function listLivePlans(limit = 250): Promise<Plan[]> {
  const snap = await db().collection("plans").where("status", "==", "live").limit(limit).get();
  return snap.docs.map((doc) => doc.data() as Plan);
}

export async function savePlan(plan: Plan): Promise<void> {
  await db().collection("plans").doc(plan.id).set(plan);
}

export async function recordPlanPaymentIssue(input: { planId: string; userId: string; subscriptionId: string; issue: NonNullable<Plan["paymentIssue"]> }): Promise<void> {
  const ref = db().collection("plans").doc(input.planId);
  await db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Plan not found");
    const plan = snap.data() as Plan;
    if (plan.userId !== input.userId || plan.stripeSubscriptionId !== input.subscriptionId) throw new Error("Invoice does not match its Pile Up plan");
    if (plan.lastPaidInvoiceId === input.issue.invoiceId || plan.paymentIssue && plan.paymentIssue.occurredAt > input.issue.occurredAt) return;
    transaction.update(ref, { paymentIssue: input.issue, updatedAt: now() });
  });
}

export async function confirmPlanInvoicePayment(input: { planId: string; userId: string; subscriptionId: string; invoiceId: string }): Promise<void> {
  const ref = db().collection("plans").doc(input.planId);
  await db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Plan not found");
    const plan = snap.data() as Plan;
    if (plan.userId !== input.userId || plan.stripeSubscriptionId !== input.subscriptionId) throw new Error("Invoice does not match its Pile Up plan");
    transaction.update(ref, {
      ...(plan.status === "pending_payment" ? { status: "live" } : {}),
      lastPaidInvoiceId: input.invoiceId,
      ...(plan.paymentIssue ? { paymentIssue: FieldValue.delete() } : {}),
      updatedAt: now()
    });
  });
}

export async function cancelPlan(input: { planId: string; userId: string; subscriptionId: string }): Promise<void> {
  const ref = db().collection("plans").doc(input.planId);
  await db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return;
    const plan = snap.data() as Plan;
    if (plan.userId !== input.userId || plan.stripeSubscriptionId !== input.subscriptionId) return;
    transaction.update(ref, { status: "cancelled", updatedAt: now() });
  });
}

export async function beginPlanChange(input: { planId: string; userId: string; key: string; expectedUpdatedAt: string; amountUsd: number; weights: BasketWeight[] }): Promise<Plan> {
  const ref = db().collection("plans").doc(input.planId);
  return db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Plan not found");
    const plan = snap.data() as Plan;
    if (plan.userId !== input.userId) throw new Error("Plan not found");
    if (plan.lastChangeKey === input.key && plan.amountUsd === input.amountUsd && JSON.stringify(plan.weights) === JSON.stringify(input.weights)) return plan;
    if (plan.status !== "live" || !plan.stripeSubscriptionId) throw new Error("Only a live weekly plan can be changed");
    if (plan.pendingPauseKey) throw new Error("A weekly plan pause is in progress");
    if (plan.updatedAt !== input.expectedUpdatedAt) throw new Error("Plan changed; refresh before trying again");
    if (plan.pendingChange) {
      if (plan.pendingChange.key !== input.key || plan.pendingChange.amountUsd !== input.amountUsd || JSON.stringify(plan.pendingChange.weights) !== JSON.stringify(input.weights)) throw new Error("Another plan change is in progress");
      return plan;
    }
    const pendingChange = { key: input.key, amountUsd: input.amountUsd, weights: input.weights, expectedUpdatedAt: input.expectedUpdatedAt, startedAt: now() };
    transaction.update(ref, { pendingChange });
    return { ...plan, pendingChange };
  });
}

export async function finalizePlanChange(input: { planId: string; key: string; priceId: string; previousPriceId: string }): Promise<Plan> {
  const ref = db().collection("plans").doc(input.planId);
  return db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Plan not found");
    const plan = snap.data() as Plan;
    const change = plan.pendingChange;
    if (!change || change.key !== input.key || plan.updatedAt !== change.expectedUpdatedAt) throw new Error("Plan change no longer matches its review");
    const updatedAt = now();
    const priorRevisions = [...(plan.priorRevisions ?? []), { amountUsd: plan.amountUsd, weights: plan.weights, stripePriceId: input.previousPriceId, effectiveAt: plan.updatedAt }];
    transaction.update(ref, { amountUsd: change.amountUsd, weights: change.weights, stripePriceId: input.priceId, priorRevisions, updatedAt, lastChangeKey: input.key, pendingChange: FieldValue.delete() });
    return { ...plan, amountUsd: change.amountUsd, weights: change.weights, stripePriceId: input.priceId, priorRevisions, updatedAt, lastChangeKey: input.key, pendingChange: undefined };
  });
}

export async function releasePlanChange(planId: string, key: string): Promise<void> {
  const ref = db().collection("plans").doc(planId);
  await db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (snap.exists && (snap.data() as Plan).pendingChange?.key === key) transaction.update(ref, { pendingChange: FieldValue.delete() });
  });
}

export async function beginPlanPause(input: { planId: string; userId: string; key: string; expectedUpdatedAt: string }): Promise<Plan> {
  const ref = db().collection("plans").doc(input.planId);
  return db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Plan not found");
    const plan = snap.data() as Plan;
    if (plan.userId !== input.userId) throw new Error("Plan not found");
    if (plan.lastPauseKey === input.key && plan.status === "paused") return plan;
    if (plan.status !== "live" || !plan.stripeSubscriptionId) throw new Error("Only a live weekly plan can be paused");
    if (plan.updatedAt !== input.expectedUpdatedAt) throw new Error("Plan changed; refresh before trying again");
    if (plan.pendingChange) throw new Error("A weekly plan change is in progress");
    if (plan.pendingPauseKey && plan.pendingPauseKey !== input.key) throw new Error("Another pause is in progress");
    transaction.update(ref, { pendingPauseKey: input.key });
    return { ...plan, pendingPauseKey: input.key };
  });
}

export async function finalizePlanPause(planId: string, key: string): Promise<Plan> {
  const ref = db().collection("plans").doc(planId);
  return db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Plan not found");
    const plan = snap.data() as Plan;
    if (plan.pendingPauseKey !== key || plan.status !== "live") throw new Error("Plan pause no longer matches its review");
    const updatedAt = now();
    transaction.update(ref, { status: "paused", updatedAt, lastPauseKey: key, pendingPauseKey: FieldValue.delete() });
    return { ...plan, status: "paused", updatedAt, lastPauseKey: key, pendingPauseKey: undefined };
  });
}

export async function beginPlanResume(input: { planId: string; userId: string; key: string; expectedUpdatedAt: string }): Promise<Plan> {
  const ref = db().collection("plans").doc(input.planId);
  return db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Plan not found");
    const plan = snap.data() as Plan;
    if (plan.userId !== input.userId) throw new Error("Plan not found");
    if (plan.lastResumeKey === input.key && plan.status === "live") return plan;
    if (plan.status !== "paused" || !plan.stripeSubscriptionId) throw new Error("Only a paused weekly plan can be resumed");
    if (plan.updatedAt !== input.expectedUpdatedAt) throw new Error("Plan changed; refresh before trying again");
    if (plan.pendingChange || plan.pendingPauseKey) throw new Error("Another plan action is in progress");
    if (plan.pendingResumeKey && plan.pendingResumeKey !== input.key) throw new Error("Another resume is in progress");
    transaction.update(ref, { pendingResumeKey: input.key });
    return { ...plan, pendingResumeKey: input.key };
  });
}

export async function finalizePlanResume(planId: string, key: string): Promise<Plan> {
  const ref = db().collection("plans").doc(planId);
  return db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Plan not found");
    const plan = snap.data() as Plan;
    if (plan.pendingResumeKey !== key || plan.status !== "paused") throw new Error("Plan resume no longer matches its review");
    const updatedAt = now();
    transaction.update(ref, { status: "live", updatedAt, lastResumeKey: key, pendingResumeKey: FieldValue.delete() });
    return { ...plan, status: "live", updatedAt, lastResumeKey: key, pendingResumeKey: undefined };
  });
}

export async function getCycle(id: string): Promise<FundingCycle | undefined> {
  const snap = await db().collection("fundingCycles").doc(id).get();
  return snap.exists ? snap.data() as FundingCycle : undefined;
}

export async function getLatestCycle(userId: string): Promise<FundingCycle | undefined> {
  const snap = await db().collection("fundingCycles").where("userId", "==", userId).orderBy("updatedAt", "desc").limit(1).get();
  return snap.empty ? undefined : snap.docs[0].data() as FundingCycle;
}

export async function saveCycle(cycle: FundingCycle): Promise<void> {
  await db().collection("fundingCycles").doc(cycle.id).set({ ...cycle, updatedAt: now() }, { merge: true });
}

export async function claimWebhook(eventId: string, provider: "stripe" | "bridge"): Promise<"claimed" | "existing"> {
  const ref = db().collection("webhookEvents").doc(`${provider}_${eventId}`);
  return db().runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    if (current.exists) return "existing" as const;
    transaction.create(ref, { provider, eventId, state: "received", receivedAt: now(), expiresAt: new Date(Date.now() + 30 * 86400_000) });
    return "claimed" as const;
  });
}

export async function updateWebhookState(eventId: string, provider: "stripe" | "bridge", state: "validated" | "queued" | "processed" | "retryable_failure", update: Record<string, unknown> = {}): Promise<void> {
  await db().collection("webhookEvents").doc(`${provider}_${eventId}`).set({ state, ...update, updatedAt: now() }, { merge: true });
}

export async function getUser(userId: string): Promise<Record<string, unknown> | undefined> {
  const snap = await db().collection("users").doc(userId).get();
  return snap.exists ? snap.data() : undefined;
}

export async function saveUser(userId: string, update: Record<string, unknown>): Promise<void> {
  await db().collection("users").doc(userId).set({ ...update, updatedAt: now() }, { merge: true });
}

export async function getCard(userId: string): Promise<CardRecord | undefined> {
  const snap = await db().collection("cards").doc(userId).get();
  return snap.exists ? snap.data() as CardRecord : undefined;
}

export async function saveCard(card: CardRecord): Promise<void> {
  await db().collection("cards").doc(card.userId).set(card, { merge: true });
}

/** A capped hackathon faucet reservation, not a settlement or balance ledger. */
export async function reserveDemoCredit(input: {
  userId: string;
  cycleId: string;
  amountUsd: number;
  globalCapUsd: number;
  walletCapUsd: number;
}): Promise<void> {
  const reservation = db().collection("demoCreditReservations").doc(`${input.userId}_${input.cycleId}`);
  const global = db().collection("demoTreasury").doc("global");
  const wallet = db().collection("demoTreasury").doc(`wallet_${input.userId}`);
  await db().runTransaction(async (transaction) => {
    const [existing, globalState, walletState] = await Promise.all([transaction.get(reservation), transaction.get(global), transaction.get(wallet)]);
    if (existing.exists) return;
    const globalUsed = Number(globalState.data()?.usedUsd ?? 0);
    const walletUsed = Number(walletState.data()?.usedUsd ?? 0);
    if (globalUsed + input.amountUsd > input.globalCapUsd) throw new Error("Demo treasury global cap reached");
    if (walletUsed + input.amountUsd > input.walletCapUsd) throw new Error("Demo wallet cap reached");
    transaction.create(reservation, { ...input, createdAt: now() });
    transaction.set(global, { usedUsd: globalUsed + input.amountUsd, updatedAt: now() }, { merge: true });
    transaction.set(wallet, { usedUsd: walletUsed + input.amountUsd, updatedAt: now() }, { merge: true });
  });
}

type StoredMutationResponse = { status: number; body: Record<string, unknown> | null };
export type MutationClaim =
  | { state: "claimed" }
  | { state: "in_progress" }
  | { state: "completed"; response: StoredMutationResponse };

const mutationDocumentId = (userId: string, operation: string, key: string) =>
  createHash("sha256").update(`${userId}\u0000${operation}\u0000${key}`).digest("hex");

/**
 * A response cache for client mutations. It protects retries; it is not a
 * financial ledger and stores no payment or card data.
 */
export async function claimMutation(input: { userId: string; operation: string; key: string }): Promise<MutationClaim> {
  const ref = db().collection("idempotencyKeys").doc(mutationDocumentId(input.userId, input.operation, input.key));
  return db().runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.exists) {
      transaction.create(ref, { userId: input.userId, operation: input.operation, state: "in_progress", createdAt: now(), expiresAt: new Date(Date.now() + 24 * 60 * 60_000) });
      return { state: "claimed" };
    }
    const data = current.data();
    if (data?.state === "completed") return { state: "completed", response: { status: Number(data.status), body: (data.body ?? null) as Record<string, unknown> | null } };
    return { state: "in_progress" };
  });
}

export async function completeMutation(input: { userId: string; operation: string; key: string; response: StoredMutationResponse }): Promise<void> {
  const ref = db().collection("idempotencyKeys").doc(mutationDocumentId(input.userId, input.operation, input.key));
  await ref.set({ state: "completed", status: input.response.status, body: input.response.body, completedAt: now() }, { merge: true });
}

export async function releaseMutation(input: { userId: string; operation: string; key: string }): Promise<void> {
  const ref = db().collection("idempotencyKeys").doc(mutationDocumentId(input.userId, input.operation, input.key));
  await db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (snap.data()?.state === "in_progress") transaction.delete(ref);
  });
}
