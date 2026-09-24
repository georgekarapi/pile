import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { getCycle, getPlan, updateWebhookState } from "../repository.js";
import { providers } from "../adapters/factory.js";
import { runFundingCycle } from "../workflows/funding-cycle.js";

export const processFundingCycle = onTaskDispatched<{ cycleId: string }>(
  {
    region: "europe-west1",
    retry: true,
    rateLimits: { maxConcurrentDispatches: 10, maxDispatchesPerSecond: 5 },
    retryConfig: { maxAttempts: 12, minBackoffSeconds: 10, maxBackoffSeconds: 3600, maxRetrySeconds: 86_400 }
  },
  async (request) => {
    const cycle = await getCycle(request.data.cycleId);
    if (!cycle) throw new Error("Funding cycle not found");
    if (cycle.state === "complete") return;
    const plan = await getPlan(cycle.planId);
    if (!plan || plan.userId !== cycle.userId) throw new Error("Funding cycle plan mismatch");
    try {
      await runFundingCycle(cycle, plan, providers());
      if (cycle.sourceEventId) await updateWebhookState(cycle.sourceEventId, "stripe", "processed", { cycleId: cycle.id });
    } catch (error) {
      if (cycle.sourceEventId) await updateWebhookState(cycle.sourceEventId, "stripe", "retryable_failure", { cycleId: cycle.id, error: error instanceof Error ? error.message : "Funding failure" });
      throw error;
    }
  }
);
