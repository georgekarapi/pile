import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { assertPlanInput, assertTransactionWithinPolicy } from "@pileup/shared";
import { z } from "zod";
import { allowedOrigins, basketRegistry, stripePriceByAmount } from "../config.js";
import { getUserId, requireAuth, type AuthenticatedRequest } from "../auth.js";
import { claimMutation, completeMutation, getCard, getCurrentPlan, getPlan, getUser, saveCard, savePlan, saveUser } from "../repository.js";
import { providers } from "../adapters/factory.js";
import { createBillingSubscription } from "../adapters/stripe-billing.js";

const planSchema = z.object({ amountUsd: z.union([z.literal(30), z.literal(50), z.literal(100)]), weights: z.array(z.object({ symbol: z.string(), mint: z.string(), bps: z.number().int() })).optional() });
const freezeSchema = z.object({ frozen: z.boolean() });

function idempotencyKey(req: express.Request): string {
  const key = req.header("idempotency-key");
  if (!key || key.length < 16 || key.length > 255) throw new Error("A valid Idempotency-Key header is required");
  return key;
}

type MutationResponse = { status: number; body: Record<string, unknown> | null };

async function respondToMutation(
  req: AuthenticatedRequest,
  res: express.Response,
  operation: string,
  work: () => Promise<MutationResponse>
): Promise<void> {
  const userId = getUserId(req);
  const key = idempotencyKey(req);
  const claim = await claimMutation({ userId, operation, key });
  if (claim.state === "completed") {
    if (claim.response.body === null) res.status(claim.response.status).end();
    else res.status(claim.response.status).json(claim.response.body);
    return;
  }
  if (claim.state === "in_progress") {
    res.status(409).json({ error: "This request is still being processed; retry shortly with the same Idempotency-Key" });
    return;
  }
  const response = await work();
  await completeMutation({ userId, operation, key, response });
  if (response.body === null) res.status(response.status).end();
  else res.status(response.status).json(response.body);
}

export const app = express();
app.use(cors({
  origin(origin, callback) {
    // Native requests have no Origin. Browser calls must be explicitly allowed.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed"));
  }
}));
app.use(express.json());

app.get("/v1/healthz", (_req, res) => res.json({ ok: true, mode: process.env.PILEUP_MODE ?? "demo" }));

app.get("/v1/plans/current", requireAuth, async (req: AuthenticatedRequest, res) => {
  const plan = await getCurrentPlan(getUserId(req));
  res.json({ plan: plan ?? null });
});

app.get("/v1/cards/current", requireAuth, async (req: AuthenticatedRequest, res) => {
  const card = await getCard(getUserId(req));
  res.json({ card: card ?? null });
});

app.post("/v1/plans", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = planSchema.parse(req.body);
    await respondToMutation(req, res, "plan_create", async () => {
      const userId = getUserId(req);
      const weights = input.weights ?? [...basketRegistry];
      assertPlanInput(input.amountUsd, weights);
      const timestamp = new Date().toISOString();
      const plan = {
        id: randomUUID(), userId, amountUsd: input.amountUsd, interval: "week" as const, weights,
        stripePriceId: stripePriceByAmount[input.amountUsd], status: "draft" as const, createdAt: timestamp, updatedAt: timestamp
      };
      await savePlan(plan);
      return { status: 201, body: { plan } };
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid plan" });
  }
});

app.post("/v1/plans/:planId/activate", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await respondToMutation(req, res, `plan_activate:${String(req.params.planId)}`, async () => {
      const plan = await getPlan(String(req.params.planId));
      if (!plan || plan.userId !== getUserId(req)) throw new Error("Plan not found");
      const user = await getUser(plan.userId);
      const checkout = await createBillingSubscription({ userId: plan.userId, planId: plan.id, priceId: plan.stripePriceId, stripeCustomerId: typeof user?.stripeCustomerId === "string" ? user.stripeCustomerId : undefined, email: typeof user?.email === "string" ? user.email : undefined, idempotencyKey: idempotencyKey(req) });
      await saveUser(plan.userId, { stripeCustomerId: checkout.customerId });
      await savePlan({ ...plan, stripeSubscriptionId: checkout.subscriptionId, status: checkout.mode === "demo" ? "live" : "pending_payment", updatedAt: new Date().toISOString() });
      return { status: 200, body: checkout };
    });
  } catch (error) {
    res.status(error instanceof Error && error.message === "Plan not found" ? 404 : 502).json({ error: error instanceof Error ? error.message : "Unable to create Stripe subscription" });
  }
});

app.post("/v1/plans/:planId/pause", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await respondToMutation(req, res, `plan_pause:${String(req.params.planId)}`, async () => {
      const plan = await getPlan(String(req.params.planId));
      if (!plan || plan.userId !== getUserId(req)) throw new Error("Plan not found");
      await savePlan({ ...plan, status: "paused", updatedAt: new Date().toISOString() });
      return { status: 204, body: null };
    });
  } catch (error) {
    res.status(error instanceof Error && error.message === "Plan not found" ? 404 : 400).json({ error: error instanceof Error ? error.message : "Unable to pause plan" });
  }
});

app.get("/v1/pile", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = getUserId(req);
  const { wallet, lend, mode } = providers();
  const address = await wallet.getAddress(userId);
  const health = await lend.getHealth(address);
  res.json({ address, health, source: mode });
});

app.get("/v1/health", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = getUserId(req);
  const { wallet, lend } = providers();
  const address = await wallet.getAddress(userId);
  res.json(await lend.getHealth(address));
});

app.post("/v1/bridge/kyc-session", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await respondToMutation(req, res, "bridge_kyc_session", async () => {
      const userId = getUserId(req);
      const { card } = providers();
      const session = await card.createKycSession(userId);
      await saveUser(userId, { kycStatus: "pending", bridgeCustomerId: `demo_bridge_${userId}` });
      return { status: 200, body: session };
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Unable to start KYC" });
  }
});

app.post("/v1/cards", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await respondToMutation(req, res, "card_provision", async () => {
      const userId = getUserId(req);
      const user = await getUser(userId);
      if (user?.kycStatus !== "approved" && process.env.PILEUP_MODE !== "demo") throw new Error("Bridge KYC approval required");
      const current = providers();
      const owner = await current.wallet.getAddress(userId);
      const result = await current.card.provision(userId, owner);
      assertTransactionWithinPolicy(result.approvalTransaction, { owner, allowedKinds: ["bridge_delegate"], allowedProgramIds: ["bridge-card", "spl-token"], allowedMints: [current.usdcMint], maxInputAtomic: 100_000_000n });
      const approvalSignature = await current.wallet.signScoped(userId, result.approvalTransaction);
      const record = { userId, bridgeCustomerId: String(user?.bridgeCustomerId ?? `demo_bridge_${userId}`), bridgeCardAccountId: result.cardAccountId, status: "sandbox" as const, mode: "bridge_sandbox" as const, updatedAt: new Date().toISOString() };
      await saveCard(record);
      return { status: 201, body: { card: record, approvalSignature: approvalSignature.signature } };
    });
  } catch (error) {
    res.status(error instanceof Error && error.message === "Bridge KYC approval required" ? 409 : 502).json({ error: error instanceof Error ? error.message : "Unable to provision card" });
  }
});

app.post("/v1/cards/:cardId/freeze", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = freezeSchema.parse(req.body);
    await respondToMutation(req, res, `card_freeze:${String(req.params.cardId)}`, async () => {
      const userId = getUserId(req);
      const card = await getCard(userId);
      if (!card || card.bridgeCardAccountId !== String(req.params.cardId)) throw new Error("Card not found");
      await providers().card.freeze(userId, input.frozen);
      await saveCard({ ...card, status: input.frozen ? "frozen" : "sandbox", updatedAt: new Date().toISOString() });
      return { status: 204, body: null };
    });
  } catch (error) {
    res.status(error instanceof Error && error.message === "Card not found" ? 404 : 400).json({ error: error instanceof Error ? error.message : "Unable to update card" });
  }
});

app.post("/v1/debt/repay", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const amountUsd = z.object({ amountUsd: z.number().positive().max(10_000) }).parse(req.body).amountUsd;
    await respondToMutation(req, res, "debt_repay", async () => {
      const userId = getUserId(req);
      const current = providers();
      const owner = await current.wallet.getAddress(userId);
      const atomic = BigInt(Math.round(amountUsd * 1_000_000));
      const transaction = await current.lend.repayUsdc({ owner, amountAtomic: atomic });
      assertTransactionWithinPolicy(transaction, {
        owner,
        allowedKinds: ["repay"],
        allowedProgramIds: ["kamino", "spl-token", "compute-budget"],
        allowedMints: [current.usdcMint],
        maxInputAtomic: atomic
      });
      const signed = await current.wallet.signScoped(userId, transaction);
      return { status: 200, body: { signature: signed.signature, amountUsd, mode: current.mode } };
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Unable to repay" });
  }
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
