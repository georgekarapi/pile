import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { getFunctions } from "firebase-admin/functions";
import Stripe from "stripe";
import type { FundingCycle } from "@pileup/shared";
import { cancelPlan, claimWebhook, confirmPlanInvoicePayment, getCycle, getPlan, recordPlanPaymentIssue, saveCycle, updateWebhookState } from "../repository.js";
import { config } from "../config.js";

type StripeInvoiceEvent = {
  id: string;
  type: string;
  livemode: boolean;
  created?: number;
  data: {
    object: {
      id: string;
      status?: string;
      currency?: string;
      amount_paid: number;
      lines?: { data?: Array<{ pricing?: { price_details?: { price?: string } }; price?: { id?: string } | string }> };
      collection_method?: string;
      subscription_details?: { metadata?: Record<string, string> };
      parent?: { subscription_details?: { subscription?: string | { id?: string }; metadata?: Record<string, string> } };
      metadata?: Record<string, string>;
    };
  };
};

function subscriptionContext(invoice: StripeInvoiceEvent["data"]["object"]): { subscriptionId?: string; metadata: Record<string, string> } {
  const details = invoice.parent?.subscription_details;
  const subscription = details?.subscription;
  return {
    subscriptionId: typeof subscription === "string" ? subscription : subscription?.id,
    metadata: details?.metadata ?? invoice.subscription_details?.metadata ?? {}
  };
}

function invoicePriceId(invoice: StripeInvoiceEvent["data"]["object"]): string | undefined {
  const prices = invoice.lines?.data?.map((line) => line.pricing?.price_details?.price ?? (typeof line.price === "string" ? line.price : line.price?.id)).filter((price): price is string => Boolean(price)) ?? [];
  return prices.length === 1 ? prices[0] : undefined;
}

async function enqueueFundingCycle(cycleId: string): Promise<void> {
  const id = createHash("sha256").update(cycleId).digest("hex");
  try {
    await getFunctions().taskQueue<{ cycleId: string }>("locations/europe-west1/functions/processFundingCycle").enqueue(
      { cycleId },
      { id, dispatchDeadlineSeconds: 1800 }
    );
  } catch (error) {
    if ((error as { code?: string }).code !== "functions/task-already-exists") throw error;
  }
}

export async function stripeWebhook(req: Request, res: Response) {
  let event: StripeInvoiceEvent;
  if (config.PILEUP_MODE === "live") {
    const signature = req.header("stripe-signature");
    if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET || !signature) return res.status(400).json({ error: "Stripe signature configuration missing" });
    try {
      const stripe = new Stripe(config.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent((req as Request & { rawBody?: Buffer }).rawBody ?? JSON.stringify(req.body), signature, config.STRIPE_WEBHOOK_SECRET) as unknown as StripeInvoiceEvent;
    } catch {
      return res.status(400).json({ error: "Invalid Stripe webhook signature" });
    }
  } else {
    event = req.body as StripeInvoiceEvent;
  }

  if (!event?.id || !["invoice.payment_succeeded", "invoice.payment_failed", "invoice.payment_action_required", "customer.subscription.deleted"].includes(event.type)) return res.status(200).json({ received: true, ignored: true });

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as unknown as Stripe.Subscription;
    const planId = subscription.metadata?.pileupPlanId;
    const userId = subscription.metadata?.pileupUserId;
    if (!planId || !userId) return res.status(400).json({ error: "Subscription lacks immutable Pile Up metadata" });
    await cancelPlan({ planId, userId, subscriptionId: subscription.id });
    const claim = await claimWebhook(event.id, "stripe");
    await updateWebhookState(event.id, "stripe", "processed", { subscriptionId: subscription.id, status: "cancelled" });
    return res.status(202).json({ received: true, duplicate: claim === "existing", status: "cancelled" });
  }

  const invoice = event.data.object;
  const context = subscriptionContext(invoice);
  const planId = context.metadata.pileupPlanId;
  const userId = context.metadata.pileupUserId;
  if (!planId || !userId || !context.subscriptionId) return res.status(400).json({ error: "Invoice lacks immutable Pile Up subscription metadata" });

  const plan = await getPlan(planId);
  if (!plan || plan.userId !== userId || plan.stripeSubscriptionId !== context.subscriptionId) return res.status(409).json({ error: "Invoice does not match its Pile Up plan" });
  if (event.type !== "invoice.payment_succeeded") {
    if (invoice.collection_method !== "charge_automatically" || invoice.currency !== "usd") return res.status(409).json({ error: "Invoice is not an automatically collected USD payment" });
    if (config.PILEUP_MODE === "live") {
      if (!event.livemode) return res.status(409).json({ error: "Test-mode Stripe event rejected in live mode" });
      const stripe = new Stripe(config.STRIPE_SECRET_KEY!);
      const [latestInvoice, subscription] = await Promise.all([stripe.invoices.retrieve(invoice.id), stripe.subscriptions.retrieve(context.subscriptionId)]);
      const latestInvoiceId = typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id;
      if (latestInvoice.status !== "open" || latestInvoiceId !== invoice.id) return res.status(200).json({ received: true, ignored: true });
    }
    const kind = event.type === "invoice.payment_failed" ? "failed" : "action_required";
    await recordPlanPaymentIssue({ planId, userId, subscriptionId: context.subscriptionId, issue: { invoiceId: invoice.id, kind, occurredAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString() } });
    const claim = await claimWebhook(event.id, "stripe");
    await updateWebhookState(event.id, "stripe", "processed", { invoiceId: invoice.id, kind });
    return res.status(202).json({ received: true, duplicate: claim === "existing", issue: kind });
  }
  if (invoice.status !== "paid" || invoice.collection_method !== "charge_automatically") return res.status(409).json({ error: "Invoice is not an automatically collected successful payment" });
  const revisions = [...(plan.priorRevisions ?? []), { amountUsd: plan.amountUsd, weights: plan.weights, stripePriceId: plan.stripePriceId ?? "", effectiveAt: plan.updatedAt }];
  const priceId = invoicePriceId(invoice);
  const matches = priceId ? revisions.filter((revision) => revision.stripePriceId === priceId) : revisions.filter((revision) => invoice.amount_paid === revision.amountUsd * 100);
  if (invoice.currency !== "usd" || matches.length !== 1 || invoice.amount_paid !== matches[0].amountUsd * 100) return res.status(409).json({ error: "Invoice price, currency or amount does not match a unique plan revision" });
  const invoiceWeights = matches[0].weights;
  if (config.PILEUP_MODE === "live" && !event.livemode) return res.status(409).json({ error: "Test-mode Stripe event rejected in live mode" });
  await confirmPlanInvoicePayment({ planId, userId, subscriptionId: context.subscriptionId, invoiceId: invoice.id });

  const claim = await claimWebhook(event.id, "stripe");
  const timestamp = new Date().toISOString();
  let cycle = await getCycle(invoice.id);
  if (!cycle) {
    cycle = {
      id: invoice.id,
      planId: plan.id,
      userId,
      expectedUsd: invoice.amount_paid / 100,
      fiatAmountMinor: invoice.amount_paid,
      fiatCurrency: invoice.currency,
      sourceEventId: event.id,
      state: "invoice_paid",
      legs: invoiceWeights.map((weight) => ({ mint: weight.mint, symbol: weight.symbol, bps: weight.bps, inputUsdcAtomic: "0", status: "pending" })),
      depositSignatures: [],
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await saveCycle(cycle);
  }
  await updateWebhookState(event.id, "stripe", "validated", { cycleId: cycle.id, claim });
  try {
    await enqueueFundingCycle(cycle.id);
    await updateWebhookState(event.id, "stripe", "queued", { cycleId: cycle.id });
  } catch (error) {
    await updateWebhookState(event.id, "stripe", "retryable_failure", { cycleId: cycle.id, error: error instanceof Error ? error.message : "Queue failure" });
    return res.status(503).json({ error: "Funding cycle could not be queued" });
  }
  return res.status(202).json({ received: true, duplicate: claim === "existing", cycle: cycle.id, state: cycle.state });
}
