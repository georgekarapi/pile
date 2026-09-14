import Stripe from "stripe";
import { config } from "../config.js";

export type SubscriptionCheckout = {
  subscriptionId: string;
  customerId: string;
  clientSecret?: string;
  ephemeralKey?: string;
  mode: "demo" | "live";
};

export async function createBillingSubscription(input: { userId: string; planId: string; priceId: string; stripeCustomerId?: string; email?: string; idempotencyKey: string }): Promise<SubscriptionCheckout> {
  if (config.PILEUP_MODE === "demo") {
    return { subscriptionId: `demo_subscription_${input.planId}`, customerId: input.stripeCustomerId ?? `demo_customer_${input.userId}`, mode: "demo" };
  }
  if (!config.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required for live Billing");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const customerId = input.stripeCustomerId ?? (await stripe.customers.create(
    { email: input.email, metadata: { pileupUserId: input.userId } },
    { idempotencyKey: `pileup-customer-${input.idempotencyKey}` }
  )).id;
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: input.priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: { pileupUserId: input.userId, pileupPlanId: input.planId },
    expand: ["latest_invoice.confirmation_secret"]
  }, { idempotencyKey: `pileup-subscription-${input.idempotencyKey}` });
  const invoice = subscription.latest_invoice as Stripe.Invoice & { confirmation_secret?: { client_secret?: string } };
  const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: "2025-06-30.basil" as Stripe.LatestApiVersion });
  const clientSecret = invoice.confirmation_secret?.client_secret;
  if (!clientSecret) throw new Error("Stripe did not return a subscription confirmation secret");
  return { subscriptionId: subscription.id, customerId, clientSecret, ephemeralKey: ephemeralKey.secret, mode: "live" };
}
