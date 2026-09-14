import type { Request, Response } from "express";
import Stripe from "stripe";
import type { FundingCycle } from "@pileup/shared";
import { getActivePlan, getCycle, claimWebhook, saveCycle } from "../repository.js";
import { providers } from "../adapters/factory.js";
import { runFundingCycle } from "../workflows/funding-cycle.js";
import { config } from "../config.js";

type InvoicePaidEvent = { id: string; type: string; data: { object: { id: string; customer?: string; metadata?: Record<string, string>; amount_paid: number } } };

export async function stripeWebhook(req: Request, res: Response) {
  let event: InvoicePaidEvent;
  if (config.PILEUP_MODE === "live") {
    const signature = req.header("stripe-signature");
    if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET || !signature) return res.status(400).json({ error: "Stripe signature configuration missing" });
    try {
      const stripe = new Stripe(config.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent((req as Request & { rawBody?: Buffer }).rawBody ?? JSON.stringify(req.body), signature, config.STRIPE_WEBHOOK_SECRET) as unknown as InvoicePaidEvent;
    } catch {
      return res.status(400).json({ error: "Invalid Stripe webhook signature" });
    }
  } else {
    event = req.body as InvoicePaidEvent;
  }
  if (!event?.id || event.type !== "invoice.paid") return res.status(200).json({ received: true });
  if (!(await claimWebhook(event.id, "stripe"))) return res.status(200).json({ received: true, duplicate: true });
  const userId = event.data.object.metadata?.pileupUserId;
  if (!userId) return res.status(400).json({ error: "Invoice lacks Pileup user metadata" });
  const plan = await getActivePlan(userId);
  if (!plan) return res.status(409).json({ error: "No active plan" });
  if (await getCycle(event.data.object.id)) return res.status(200).json({ received: true, duplicate: true });

  const timestamp = new Date().toISOString();
  const cycle: FundingCycle = {
    id: event.data.object.id, planId: plan.id, userId, expectedUsd: event.data.object.amount_paid / 100,
    state: "invoice_paid", legs: plan.weights.map((weight) => ({ mint: weight.mint, symbol: weight.symbol, inputUsdcAtomic: "0", status: "pending" })),
    depositSignatures: [], attempts: 0, createdAt: timestamp, updatedAt: timestamp
  };
  await saveCycle(cycle);
  try {
    const current = providers();
    const completed = await runFundingCycle(cycle, plan, current);
    res.status(200).json({ received: true, cycle: completed.id, state: completed.state });
  } catch (error) {
    res.status(202).json({ received: true, cycle: cycle.id, state: "needs_attention", error: error instanceof Error ? error.message : "Unknown error" });
  }
}
