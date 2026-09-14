import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import type { CardRecord, FundingCycle, Plan } from "@pileup/shared";

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

export async function listLivePlans(limit = 250): Promise<Plan[]> {
  const snap = await db().collection("plans").where("status", "==", "live").limit(limit).get();
  return snap.docs.map((doc) => doc.data() as Plan);
}

export async function savePlan(plan: Plan): Promise<void> {
  await db().collection("plans").doc(plan.id).set(plan);
}

export async function getCycle(id: string): Promise<FundingCycle | undefined> {
  const snap = await db().collection("fundingCycles").doc(id).get();
  return snap.exists ? snap.data() as FundingCycle : undefined;
}

export async function saveCycle(cycle: FundingCycle): Promise<void> {
  await db().collection("fundingCycles").doc(cycle.id).set({ ...cycle, updatedAt: now() }, { merge: true });
}

export async function claimWebhook(eventId: string, provider: "stripe" | "bridge"): Promise<boolean> {
  const ref = db().collection("webhookEvents").doc(`${provider}_${eventId}`);
  return db().runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    if (current.exists) return false;
    transaction.create(ref, { provider, receivedAt: now(), expiresAt: new Date(Date.now() + 30 * 86400_000) });
    return true;
  });
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
