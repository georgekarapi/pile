import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { assertPlanInput, assertTransactionWithinPolicy } from "@pile/shared";
import { z } from "zod";
import { allowedOrigins, config } from "../config.js";
import { fetchPreStocks } from "../services/prestocks.js";
import { getUserId, requireAuth, type AuthenticatedRequest } from "../auth.js";
import {
  beginPlanChange, beginPlanPause, beginPlanResume, claimMutation, completeMutation,
  finalizePlanChange, finalizePlanPause, finalizePlanResume, getActivePlan, getCard,
  getCurrentPlan, getLatestCycle, getPausedPlan, getPlan, getPlanOptionById,
  getPlanOptionsFromFirestore, getUser, releaseMutation, releasePlanChange, saveCard,
  savePlan, savePlanOption, saveUser, type StoredPlanOption
} from "../repository.js";
import { providers } from "../adapters/factory.js";
import { changeBillingSubscription, createBillingSubscription, createPaymentMethodPortalSession, getBillingSubscriptionCheckout, pauseBillingSubscription, resumeBillingSubscription, syncBillingPaymentMethod } from "../adapters/stripe-billing.js";
import { createBridgeKycLink, getBridgeKycLink, identityStatusFromBridge } from "../adapters/bridge-kyc.js";

const planSchema = z.object({
  amountUsd: z.number().int().min(10).max(150).multipleOf(5),
  mix: z.string().min(1).optional(),
  weights: z.array(z.object({
    symbol: z.string(),
    mint: z.string(),
    bps: z.number().int(),
    name: z.string().optional(),
    image: z.string().optional()
  })).optional()
});
const changePlanSchema = z.object({
  amountUsd: z.number().int().min(10).max(150).multipleOf(5),
  mix: z.string().min(1),
  expectedUpdatedAt: z.string().min(1)
});
const freezeSchema = z.object({ frozen: z.boolean() });

async function getWeightsForMix(mixId: string) {
  const option = await getPlanOptionById(mixId);
  if (!option) throw new Error(`Plan option "${mixId}" not found`);
  const prestocks = await fetchPreStocks().catch(() => []);
  const prestocksBySymbol = new Map(prestocks.map((item) => [item.symbol, item]));
  return option.weights.map((w) => {
    const live = prestocksBySymbol.get(w.symbol);
    return live
      ? {
          ...w,
          mint: w.mint || live.contract_address,
          name: live.name ?? w.name,
          image: live.image ?? w.image,
          markPrice: live.markPrice,
          impliedValuation: live.impliedValuation
        }
      : w;
  });
}

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
  work: () => Promise<MutationResponse>,
  releaseOnError = false
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
  let response: MutationResponse;
  try {
    response = await work();
    await completeMutation({ userId, operation, key, response });
  } catch (error) {
    if (releaseOnError) await releaseMutation({ userId, operation, key });
    throw error;
  }
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

app.get("/v1/healthz", (_req, res) => res.json({ ok: true, mode: process.env.PILE_MODE ?? process.env.PILEUP_MODE ?? "demo" }));

app.get("/v1/plans/options", async (_req, res) => {
  try {
    const [storedOptions, prestocks] = await Promise.all([
      getPlanOptionsFromFirestore(),
      fetchPreStocks()
    ]);
    const prestocksBySymbol = new Map(prestocks.map((item) => [item.symbol, item]));

    const options = storedOptions.map((opt) => {
      const weights = opt.weights.map((w) => {
        const live = prestocksBySymbol.get(w.symbol);
        return live
          ? {
              ...w,
              mint: w.mint || live.contract_address,
              name: live.name ?? w.name,
              image: live.image ?? w.image,
              markPrice: live.markPrice,
              impliedValuation: live.impliedValuation
            }
          : w;
      });
      const icons = opt.icons && opt.icons.length > 0
        ? opt.icons
        : (weights.map((w) => w.image).filter(Boolean) as string[]);
      return {
        ...opt,
        icons,
        weights
      };
    });

    res.json({ options, prestocksCatalog: prestocks });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load plan options" });
  }
});

app.post("/v1/plans/options", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const option = req.body as StoredPlanOption;
    assertPlanInput(100, option.weights);
    await savePlanOption(option);
    res.status(200).json({ option });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save plan option" });
  }
});

app.get("/v1/plans/current", requireAuth, async (req: AuthenticatedRequest, res) => {
  const plan = await getCurrentPlan(getUserId(req));
  res.json({ plan: plan ?? null });
});

app.post("/v1/billing/retry-checkout", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const plan = await getCurrentPlan(userId);
    if (!plan || plan.status !== "pending_payment" || !plan.stripeSubscriptionId) return res.status(409).json({ error: "A pending first payment is required" });
    const checkout = await getBillingSubscriptionCheckout({ subscriptionId: plan.stripeSubscriptionId, userId, planId: plan.id });
    return res.json(checkout);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Unable to retry the first payment" });
  }
});

app.post("/v1/billing/payment-method-session", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (config.PILE_MODE !== "live") return res.status(409).json({ error: "Payment method settings are unavailable in demo mode" });
    const userId = getUserId(req);
    const plan = await getCurrentPlan(userId);
    const user = await getUser(userId);
    if (!plan || (plan.status !== "live" && plan.status !== "paused") || !plan.stripeSubscriptionId || typeof user?.stripeCustomerId !== "string") return res.status(409).json({ error: "A confirmed weekly plan is required to manage its payment method" });
    const { url, defaultMethodId } = await createPaymentMethodPortalSession({ subscriptionId: plan.stripeSubscriptionId, planId: plan.id, userId, customerId: user.stripeCustomerId });
    await saveUser(userId, { paymentMethodPortalBaselineId: defaultMethodId, paymentMethodPortalPending: true });
    return res.json({ url });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Unable to open payment method settings" });
  }
});

app.post("/v1/billing/payment-method-sync", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (config.PILE_MODE !== "live") return res.status(409).json({ error: "Payment method settings are unavailable in demo mode" });
    const userId = getUserId(req);
    const plan = await getCurrentPlan(userId);
    const user = await getUser(userId);
    if (!plan || (plan.status !== "live" && plan.status !== "paused") || !plan.stripeSubscriptionId || typeof user?.stripeCustomerId !== "string") return res.status(409).json({ error: "A confirmed weekly plan is required to update its payment method" });
    if (user.paymentMethodPortalPending !== true || typeof user.paymentMethodPortalBaselineId !== "string") return res.status(409).json({ error: "Open payment method settings before updating the weekly plan" });
    const changed = await syncBillingPaymentMethod({ subscriptionId: plan.stripeSubscriptionId, planId: plan.id, userId, customerId: user.stripeCustomerId, previousDefaultMethodId: user.paymentMethodPortalBaselineId });
    if (changed) await saveUser(userId, { paymentMethodPortalPending: false });
    return res.json({ changed });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Unable to update the weekly payment method" });
  }
});

app.get("/v1/funding/latest", requireAuth, async (req: AuthenticatedRequest, res) => {
  const cycle = await getLatestCycle(getUserId(req));
  res.json({ cycle: cycle ?? null });
});

app.get("/v1/cards/current", requireAuth, async (req: AuthenticatedRequest, res) => {
  const card = await getCard(getUserId(req));
  res.json({ card: card ?? null });
});

app.get("/v1/identity/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const user = await getUser(userId);
    if (config.PILE_MODE === "live" && typeof user?.bridgeKycLinkId === "string") {
      const link = await getBridgeKycLink(user.bridgeKycLinkId);
      const status = identityStatusFromBridge(link);
      await saveUser(userId, { kycStatus: status, ...(status === "approved" && link.customer_id ? { bridgeCustomerId: link.customer_id } : {}) });
      return res.json({ status });
    }
    if (config.PILE_MODE === "live") return res.json({ status: "not_started" });
    const status = user?.kycStatus;
    return res.json({ status: status === "terms_pending" || status === "started" || status === "approved" || status === "pending" || status === "needs_information" || status === "unavailable" ? status : "not_started" });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "Identity status unavailable" });
  }
});

app.post("/v1/plans", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = planSchema.parse(req.body);
    await respondToMutation(req, res, "plan_create", async () => {
      const userId = getUserId(req);
      if (await getActivePlan(userId)) throw new Error("An active weekly plan already exists; change it from your weekly plan screen");
      if (await getPausedPlan(userId)) throw new Error("A paused weekly plan already exists; resume it from your weekly plan screen");
      if ((await getCurrentPlan(userId))?.status === "pending_payment") throw new Error("A weekly payment is still being confirmed");
      const weights = input.weights ?? (await getWeightsForMix(input.mix ?? "prestocks"));
      assertPlanInput(input.amountUsd, weights);
      const timestamp = new Date().toISOString();
      const plan = {
        id: randomUUID(), userId, amountUsd: input.amountUsd, interval: "week" as const, weights,
        status: "draft" as const, createdAt: timestamp, updatedAt: timestamp
      };
      await savePlan(plan);
      return { status: 201, body: { plan } };
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid plan" });
  }
});

app.patch("/v1/plans/:planId", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = changePlanSchema.parse(req.body);
    const weights = await getWeightsForMix(input.mix);
    assertPlanInput(input.amountUsd, weights);
    const key = idempotencyKey(req);
    const plan = await beginPlanChange({ planId: String(req.params.planId), userId: getUserId(req), key, expectedUpdatedAt: input.expectedUpdatedAt, amountUsd: input.amountUsd, weights });
    if (plan.lastChangeKey === key) return res.json({ plan });
    if (plan.amountUsd === input.amountUsd && JSON.stringify(plan.weights) === JSON.stringify(weights)) {
      await releasePlanChange(plan.id, key);
      return res.json({ plan: { ...plan, pendingChange: undefined } });
    }
    const changed = await changeBillingSubscription({ subscriptionId: plan.stripeSubscriptionId!, userId: plan.userId, planId: plan.id, amountUsd: input.amountUsd, previousPriceId: plan.stripePriceId, idempotencyKey: key });
    const updated = await finalizePlanChange({ planId: plan.id, key, priceId: changed.priceId, previousPriceId: changed.previousPriceId });
    return res.json({ plan: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to change weekly plan";
    const status = message === "Plan not found" ? 404 : /Plan changed|Another plan change|Only a live|does not match|must be reconciled/.test(message) ? 409 : 400;
    return res.status(status).json({ error: message });
  }
});

app.post("/v1/plans/:planId/activate", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await respondToMutation(req, res, `plan_activate:${String(req.params.planId)}`, async () => {
      const key = idempotencyKey(req);
      const plan = await getPlan(String(req.params.planId));
      if (!plan || plan.userId !== getUserId(req)) throw new Error("Plan not found");
      if (plan.activationKey === key && plan.stripeSubscriptionId && (plan.status === "pending_payment" || plan.status === "live")) {
        const checkout = await getBillingSubscriptionCheckout({ subscriptionId: plan.stripeSubscriptionId, userId: plan.userId, planId: plan.id });
        return { status: 200, body: checkout };
      }
      if (plan.status !== "draft") throw new Error("Only a draft plan can be activated");
      const existingLive = await getActivePlan(plan.userId);
      if (existingLive) throw new Error("An active weekly plan already exists; change it from your weekly plan screen");
      if (await getPausedPlan(plan.userId)) throw new Error("A paused weekly plan already exists; resume it from your weekly plan screen");
      const user = await getUser(plan.userId);
      const checkout = await createBillingSubscription({ userId: plan.userId, planId: plan.id, amountUsd: plan.amountUsd, priceId: plan.stripePriceId, stripeCustomerId: typeof user?.stripeCustomerId === "string" ? user.stripeCustomerId : undefined, email: typeof user?.email === "string" ? user.email : undefined, idempotencyKey: key });
      await saveUser(plan.userId, { stripeCustomerId: checkout.customerId });
      await savePlan({ ...plan, activationKey: key, stripeSubscriptionId: checkout.subscriptionId, stripePriceId: checkout.priceId ?? plan.stripePriceId, status: checkout.mode === "demo" ? "live" : "pending_payment", updatedAt: new Date().toISOString() });
      return { status: 200, body: checkout };
    }, true);
  } catch (error) {
    res.status(error instanceof Error && error.message === "Plan not found" ? 404 : 502).json({ error: error instanceof Error ? error.message : "Unable to create Stripe subscription" });
  }
});

app.post("/v1/plans/:planId/pause", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const expectedUpdatedAt = z.object({ expectedUpdatedAt: z.string().min(1) }).parse(req.body).expectedUpdatedAt;
    const key = idempotencyKey(req);
    const plan = await beginPlanPause({ planId: String(req.params.planId), userId: getUserId(req), key, expectedUpdatedAt });
    if (plan.lastPauseKey === key) return res.status(204).end();
    await pauseBillingSubscription({ subscriptionId: plan.stripeSubscriptionId!, userId: plan.userId, planId: plan.id, priceId: plan.stripePriceId, idempotencyKey: key });
    await finalizePlanPause(plan.id, key);
    return res.status(204).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to pause plan";
    return res.status(message === "Plan not found" ? 404 : /Plan changed|Only a live|in progress|no longer matches|does not match|reconcile/.test(message) ? 409 : 400).json({ error: message });
  }
});

app.post("/v1/plans/:planId/resume", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const expectedUpdatedAt = z.object({ expectedUpdatedAt: z.string().min(1) }).parse(req.body).expectedUpdatedAt;
    const key = idempotencyKey(req);
    const plan = await beginPlanResume({ planId: String(req.params.planId), userId: getUserId(req), key, expectedUpdatedAt });
    if (plan.lastResumeKey === key) return res.status(204).end();
    await resumeBillingSubscription({ subscriptionId: plan.stripeSubscriptionId!, userId: plan.userId, planId: plan.id, priceId: plan.stripePriceId, idempotencyKey: key });
    await finalizePlanResume(plan.id, key);
    return res.status(204).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resume plan";
    return res.status(message === "Plan not found" ? 404 : /Plan changed|Only a paused|in progress|does not match|reconcile|no longer matches/.test(message) ? 409 : 400).json({ error: message });
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
    if (config.PILE_MODE !== "live") return res.status(409).json({ error: "Hosted identity verification is unavailable in demo mode" });
    await respondToMutation(req, res, "bridge_kyc_session", async () => {
      const userId = getUserId(req);
      const user = await getUser(userId);
      const link = typeof user?.bridgeKycLinkId === "string"
        ? await getBridgeKycLink(user.bridgeKycLinkId)
        : await createBridgeKycLink({ userId, ...z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().email() }).parse(req.body) });
      const status = identityStatusFromBridge(link);
      await saveUser(userId, { bridgeKycLinkId: link.id, kycStatus: status, ...(status === "approved" && link.customer_id ? { bridgeCustomerId: link.customer_id } : {}) });
      return { status: 200, body: { tosUrl: link.tos_link, kycUrl: link.kyc_link, status } };
    }, true);
  } catch (error) {
    res.status(error instanceof z.ZodError ? 400 : 502).json({ error: error instanceof Error ? error.message : "Unable to start identity verification" });
  }
});

app.post("/v1/cards", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await respondToMutation(req, res, "card_provision", async () => {
      const userId = getUserId(req);
      const user = await getUser(userId);
      if (config.PILE_MODE === "live") {
        if (typeof user?.bridgeKycLinkId !== "string" || !user.bridgeCustomerId) throw new Error("Bridge KYC approval required");
        const link = await getBridgeKycLink(user.bridgeKycLinkId);
        if (identityStatusFromBridge(link) !== "approved" || link.customer_id !== user.bridgeCustomerId) throw new Error("Bridge KYC approval required");
      }
      const current = providers();
      const owner = await current.wallet.getAddress(userId);
      const health = await current.lend.getHealth(owner);
      const plan = await getCurrentPlan(userId);
      const hasCollateralEligibleLegs = plan?.weights.some(
        (w) => !w.mint.startsWith("Pre") && !["OPENAI", "SPACEX", "ANTHROPIC", "ANDURIL", "FIGUREAI"].includes(w.symbol)
      );
      if (health.collateralUsd === 0 && plan && !hasCollateralEligibleLegs) {
        throw new Error("Card spending requires collateral-eligible investments. Pre-IPO equity cannot be used as loan collateral on Kamino.");
      }
      const result = await current.card.provision(userId, owner);
      assertTransactionWithinPolicy(result.approvalTransaction, { owner, allowedKinds: ["bridge_delegate"], allowedProgramIds: ["bridge-card", "spl-token"], allowedMints: [current.usdcMint], allowedRecipients: ["bridge-card"], maxInputAtomic: 100_000_000n });
      const approvalSignature = await current.wallet.signScoped(userId, result.approvalTransaction);
      const record = { userId, bridgeCustomerId: String(user?.bridgeCustomerId ?? `demo_bridge_${userId}`), bridgeCardAccountId: result.cardAccountId, status: "sandbox" as const, mode: "bridge_sandbox" as const, updatedAt: new Date().toISOString() };
      await saveCard(record);
      return { status: 201, body: { card: record, approvalSignature: approvalSignature.signature } };
    });
  } catch (error) {
    res.status(
      error instanceof Error && error.message === "Bridge KYC approval required"
        ? 409
        : error instanceof Error && error.message.includes("Pre-IPO")
          ? 400
          : 502
    ).json({ error: error instanceof Error ? error.message : "Unable to provision card" });
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
    const amountUsd = z.object({ amountUsd: z.number().positive().max(10_000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "Use whole cents") }).parse(req.body).amountUsd;
    await respondToMutation(req, res, "debt_repay", async () => {
      const userId = getUserId(req);
      const current = providers();
      const owner = await current.wallet.getAddress(userId);
      const health = await current.lend.getHealth(owner);
      if (health.status === "stale") throw new Error("Balance is updating; refresh before repaying");
      const availableToRepayUsd = Math.floor(Math.min(health.debtUsd, health.walletUsdcUsd) * 100) / 100;
      if (amountUsd > availableToRepayUsd || availableToRepayUsd < 0.01) throw new Error("Repayment amount exceeds current debt or wallet USDC; refresh your balance");
      const atomic = BigInt(Math.round(amountUsd * 1_000_000));
      const transaction = await current.lend.buildRepayUsdc({ owner, amountAtomic: atomic });
      assertTransactionWithinPolicy(transaction, {
        owner,
        allowedKinds: ["repay"],
        allowedProgramIds: ["kamino", "spl-token", "compute-budget"],
        allowedMints: [current.usdcMint],
        allowedRecipients: ["kamino"],
        maxInputAtomic: atomic
      });
      const signed = await current.wallet.signScoped(userId, transaction);
      const submitted = await current.lend.submit({ transaction, signed });
      await current.lend.confirm(submitted.signature);
      return { status: 200, body: { signature: submitted.signature, amountUsd, mode: current.mode } };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to repay";
    res.status(error instanceof z.ZodError ? 400 : /refresh before repaying|refresh your balance/.test(message) ? 409 : 502).json({ error: message });
  }
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
