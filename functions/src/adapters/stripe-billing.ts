import Stripe from "stripe";
import { config } from "../config.js";

export type SubscriptionCheckout = {
  subscriptionId: string;
  customerId: string;
  priceId?: string;
  clientSecret?: string;
  ephemeralKey?: string;
  mode: "demo" | "live";
};

export async function createBillingSubscription(input: { userId: string; planId: string; amountUsd: number; priceId?: string; stripeCustomerId?: string; email?: string; idempotencyKey: string }): Promise<SubscriptionCheckout> {
  if (config.PILE_MODE === "demo") {
    return { subscriptionId: `demo_subscription_${input.planId}`, customerId: input.stripeCustomerId ?? `demo_customer_${input.userId}`, priceId: `demo_price_${input.planId}_${input.amountUsd}`, mode: "demo" };
  }
  if (!config.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required for live Billing");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const customerId = input.stripeCustomerId ?? (await stripe.customers.create(
    { email: input.email, metadata: { pileUserId: input.userId } },
    { idempotencyKey: `pile-customer-${input.idempotencyKey}` }
  )).id;
  if (!input.priceId && config.PILE_STRIPE_PRODUCT_ID.includes("CONFIGURE_")) throw new Error("PILE_STRIPE_PRODUCT_ID is required for live Billing");
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [input.priceId ? { price: input.priceId } : { price_data: { currency: "usd", product: config.PILE_STRIPE_PRODUCT_ID, recurring: { interval: "week" }, unit_amount: input.amountUsd * 100 } }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: { pileUserId: input.userId, pilePlanId: input.planId },
    expand: ["latest_invoice.confirmation_secret", "latest_invoice.payment_intent"]
  }, { idempotencyKey: `pile-subscription-${input.idempotencyKey}` });
  const invoice = subscription.latest_invoice as Stripe.Invoice & { confirmation_secret?: { client_secret?: string }; payment_intent?: Stripe.PaymentIntent | string };
  const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: "2025-06-30.basil" as Stripe.LatestApiVersion });
  let clientSecret = invoice.confirmation_secret?.client_secret;
  if (!clientSecret && typeof invoice.payment_intent === "object" && invoice.payment_intent?.client_secret) {
    clientSecret = invoice.payment_intent.client_secret;
  }
  if (!clientSecret && typeof invoice.payment_intent === "string") {
    const pi = await stripe.paymentIntents.retrieve(invoice.payment_intent);
    clientSecret = pi.client_secret ?? undefined;
  }
  if (!clientSecret) throw new Error("Stripe did not return a subscription confirmation secret");
  return { subscriptionId: subscription.id, customerId, priceId: subscription.items.data[0]?.price.id, clientSecret, ephemeralKey: ephemeralKey.secret, mode: "live" };
}

export async function getBillingSubscriptionCheckout(input: { subscriptionId: string; userId: string; planId: string }): Promise<SubscriptionCheckout> {
  if (config.PILE_MODE === "demo") return { subscriptionId: input.subscriptionId, customerId: `demo_customer_${input.userId}`, mode: "demo" };
  if (!config.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required for live Billing");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId, { expand: ["latest_invoice.confirmation_secret", "latest_invoice.payment_intent"] });
  const subUserId = subscription.metadata.pileUserId ?? subscription.metadata.pileupUserId;
  const subPlanId = subscription.metadata.pilePlanId ?? subscription.metadata.pileupPlanId;
  if (subUserId !== input.userId || subPlanId !== input.planId) throw new Error("Stripe subscription does not match this plan");
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const invoice = subscription.latest_invoice as Stripe.Invoice & { confirmation_secret?: { client_secret?: string }; payment_intent?: Stripe.PaymentIntent | string };
  let clientSecret = invoice?.confirmation_secret?.client_secret;
  if (!clientSecret && typeof invoice?.payment_intent === "object" && invoice.payment_intent?.client_secret) {
    clientSecret = invoice.payment_intent.client_secret;
  }
  if (!clientSecret && typeof invoice?.payment_intent === "string") {
    const pi = await stripe.paymentIntents.retrieve(invoice.payment_intent);
    clientSecret = pi.client_secret ?? undefined;
  }
  if (!clientSecret) throw new Error("Stripe did not return a subscription confirmation secret");
  const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: "2025-06-30.basil" as Stripe.LatestApiVersion });
  return { subscriptionId: subscription.id, customerId, priceId: subscription.items.data[0]?.price.id, clientSecret, ephemeralKey: ephemeralKey.secret, mode: "live" };
}

export async function createPaymentMethodPortalSession(input: { subscriptionId: string; userId: string; planId: string; customerId: string }): Promise<{ url: string; defaultMethodId: string }> {
  if (config.PILE_MODE !== "live" || !config.STRIPE_SECRET_KEY) throw new Error("Stripe Billing is unavailable");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
  const subscriptionCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const subUserId = subscription.metadata.pileUserId ?? subscription.metadata.pileupUserId;
  const subPlanId = subscription.metadata.pilePlanId ?? subscription.metadata.pileupPlanId;
  if (subUserId !== input.userId || subPlanId !== input.planId || subscriptionCustomerId !== input.customerId) throw new Error("Stripe subscription does not match this account");
  const customer = await stripe.customers.retrieve(input.customerId);
  if (customer.deleted) throw new Error("Stripe customer is unavailable");
  const defaultMethod = customer.invoice_settings.default_payment_method;
  const defaultMethodId = typeof defaultMethod === "string" ? defaultMethod : defaultMethod?.id ?? "";
  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    ...(config.PILE_STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: config.PILE_STRIPE_PORTAL_CONFIGURATION_ID } : {}),
    flow_data: { type: "payment_method_update" }
  });
  if (!session.url.startsWith("https://billing.stripe.com/")) throw new Error("Stripe returned an unexpected portal URL");
  return { url: session.url, defaultMethodId };
}

export async function syncBillingPaymentMethod(input: { subscriptionId: string; userId: string; planId: string; customerId: string; previousDefaultMethodId: string }): Promise<boolean> {
  if (config.PILE_MODE !== "live" || !config.STRIPE_SECRET_KEY) throw new Error("Stripe Billing is unavailable");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
  const subscriptionCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const subUserId = subscription.metadata.pileUserId ?? subscription.metadata.pileupUserId;
  const subPlanId = subscription.metadata.pilePlanId ?? subscription.metadata.pileupPlanId;
  if (subUserId !== input.userId || subPlanId !== input.planId || subscriptionCustomerId !== input.customerId) throw new Error("Stripe subscription does not match this account");
  const customer = await stripe.customers.retrieve(input.customerId);
  if (customer.deleted) throw new Error("Stripe customer is unavailable");
  const defaultMethod = customer.invoice_settings.default_payment_method;
  const paymentMethodId = typeof defaultMethod === "string" ? defaultMethod : defaultMethod?.id;
  if (!paymentMethodId || paymentMethodId === input.previousDefaultMethodId) return false;
  const currentMethod = subscription.default_payment_method;
  const currentMethodId = typeof currentMethod === "string" ? currentMethod : currentMethod?.id;
  if (currentMethodId === paymentMethodId) return false;
  await stripe.subscriptions.update(input.subscriptionId, { default_payment_method: paymentMethodId }, { idempotencyKey: `pile-payment-method-${input.subscriptionId}-${paymentMethodId}` });
  return true;
}

export async function changeBillingSubscription(input: { subscriptionId: string; userId: string; planId: string; amountUsd: number; previousPriceId?: string; idempotencyKey: string }): Promise<{ priceId: string; previousPriceId: string }> {
  if (config.PILE_MODE === "demo") return { priceId: `demo_price_${input.amountUsd}_${input.idempotencyKey}`, previousPriceId: input.previousPriceId ?? `demo_price_${input.planId}_legacy` };
  if (!config.STRIPE_SECRET_KEY || config.PILE_STRIPE_PRODUCT_ID.includes("CONFIGURE_")) throw new Error("Stripe Billing is not configured");
  if (!input.previousPriceId) throw new Error("The current subscription price must be reconciled before changing this plan");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const current = await stripe.subscriptions.retrieve(input.subscriptionId);
  const currentUserId = current.metadata.pileUserId ?? current.metadata.pileupUserId;
  const currentPlanId = current.metadata.pilePlanId ?? current.metadata.pileupPlanId;
  if (currentUserId !== input.userId || currentPlanId !== input.planId || current.status !== "active") throw new Error("The active Stripe subscription does not match this plan");
  if (current.items.data.length !== 1) throw new Error("Expected exactly one subscription item");
  const item = current.items.data[0];
  const targetPrice = await stripe.prices.create({ currency: "usd", product: config.PILE_STRIPE_PRODUCT_ID, recurring: { interval: "week" }, unit_amount: input.amountUsd * 100, metadata: { pilePlanId: input.planId, pilePlanChangeKey: input.idempotencyKey } }, { idempotencyKey: `pile-change-price-${input.idempotencyKey}` });
  if (item.price.id !== input.previousPriceId) {
    if (item.price.id === targetPrice.id) return { priceId: item.price.id, previousPriceId: input.previousPriceId };
    throw new Error("Subscription price changed; refresh the plan before trying again");
  }
  const changed = await stripe.subscriptions.update(input.subscriptionId, {
    items: [{ id: item.id, price: targetPrice.id }],
    proration_behavior: "none",
    billing_cycle_anchor: "unchanged"
  }, { idempotencyKey: `pile-change-${input.idempotencyKey}` });
  const priceId = changed.items.data[0]?.price.id;
  if (!priceId) throw new Error("Stripe did not return the updated subscription price");
  return { priceId, previousPriceId: item.price.id };
}

export async function pauseBillingSubscription(input: { subscriptionId: string; userId: string; planId: string; priceId?: string; idempotencyKey: string }): Promise<void> {
  if (config.PILE_MODE === "demo") return;
  if (!config.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required for live Billing");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
  const subUserId = subscription.metadata.pileUserId ?? subscription.metadata.pileupUserId;
  const subPlanId = subscription.metadata.pilePlanId ?? subscription.metadata.pileupPlanId;
  if (subUserId !== input.userId || subPlanId !== input.planId || subscription.status !== "active") throw new Error("Stripe subscription does not match this plan");
  if (subscription.items.data.length !== 1 || (input.priceId && subscription.items.data[0]?.price.id !== input.priceId)) throw new Error("Subscription price changed; reconcile before pausing");
  if (subscription.pause_collection?.behavior === "void") return;
  await stripe.subscriptions.update(input.subscriptionId, { pause_collection: { behavior: "void" } }, { idempotencyKey: `pile-pause-${input.idempotencyKey}` });
}

export async function resumeBillingSubscription(input: { subscriptionId: string; userId: string; planId: string; priceId?: string; idempotencyKey: string }): Promise<void> {
  if (config.PILE_MODE === "demo") return;
  if (!config.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required for live Billing");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
  const subUserId = subscription.metadata.pileUserId ?? subscription.metadata.pileupUserId;
  const subPlanId = subscription.metadata.pilePlanId ?? subscription.metadata.pileupPlanId;
  if (subUserId !== input.userId || subPlanId !== input.planId || subscription.status !== "active") throw new Error("Stripe subscription does not match this plan");
  if (subscription.items.data.length !== 1 || (input.priceId && subscription.items.data[0]?.price.id !== input.priceId)) throw new Error("Subscription price changed; reconcile before resuming");
  if (!subscription.pause_collection) return;
  await stripe.subscriptions.update(input.subscriptionId, { pause_collection: "" }, { idempotencyKey: `pile-resume-${input.idempotencyKey}` });
}
