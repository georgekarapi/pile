import { initializeApp, getApps } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { app } from "./http/app.js";
import { stripeWebhook } from "./webhooks/stripe.js";
import { assertLiveConfiguration } from "./config.js";
import { providers } from "./adapters/factory.js";
import { getCard, listLivePlans, saveCard, saveUser } from "./repository.js";

if (!getApps().length) initializeApp();
assertLiveConfiguration();

app.post("/webhooks/stripe", stripeWebhook);

export const api = onRequest({ region: "europe-west1", cors: false }, app);

export const refreshHealth = onSchedule({ schedule: "every 5 minutes", region: "europe-west1" }, async () => {
  const current = providers();
  const plans = await listLivePlans();
  let frozen = 0;
  for (const plan of plans) {
    const address = await current.wallet.getAddress(plan.userId);
    const health = await current.lend.getHealth(address);
    await saveUser(plan.userId, { lastHealth: health, healthStatus: health.status, healthObservedAt: health.observedAt });
    const card = await getCard(plan.userId);
    // Freeze only as a defensive spending control. This job never borrows or
    // sells collateral, and never unfreezes a user-controlled card.
    if (health.status === "critical" && card?.bridgeCardAccountId && card.status !== "frozen") {
      await current.card.freeze(plan.userId, true);
      await saveCard({ ...card, status: "frozen", updatedAt: new Date().toISOString() });
      frozen += 1;
    }
  }
  console.info("Pileup health refresh completed", { mode: current.mode, plans: plans.length, frozen });
});
