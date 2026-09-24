import { createHash } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";

const linkSchema = z.object({
  id: z.string().min(1),
  kyc_link: z.string().url(),
  tos_link: z.string().url(),
  kyc_status: z.string(),
  tos_status: z.string(),
  customer_id: z.string().nullable().optional()
});

export type BridgeKycLink = z.infer<typeof linkSchema>;
export type IdentityStatus = "not_started" | "terms_pending" | "started" | "pending" | "needs_information" | "approved" | "unavailable";

function bridgeApiKey(): string {
  if (!config.BRIDGE_API_KEY) throw new Error("BRIDGE_API_KEY is required for hosted identity verification");
  return config.BRIDGE_API_KEY;
}

async function bridgeRequest(path: string, init: RequestInit = {}): Promise<BridgeKycLink> {
  const response = await fetch(`https://api.bridge.xyz/v0${path}`, {
    ...init,
    headers: { "Api-Key": bridgeApiKey(), "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Bridge identity request failed (${response.status})`);
  const link = linkSchema.parse(await response.json());
  if (!link.kyc_link.startsWith("https://") || !link.tos_link.startsWith("https://")) throw new Error("Bridge returned an insecure identity link");
  return link;
}

export async function createBridgeKycLink(input: { userId: string; fullName: string; email: string }): Promise<BridgeKycLink> {
  const hash = createHash("sha256").update(`${input.userId}\u0000${input.fullName.trim().toLowerCase()}\u0000${input.email.trim().toLowerCase()}`).digest("hex");
  return bridgeRequest("/kyc_links", {
    method: "POST",
    headers: { "Idempotency-Key": `pileup-kyc-${hash}` },
    body: JSON.stringify({ full_name: input.fullName.trim(), email: input.email.trim().toLowerCase(), type: "individual" })
  });
}

export async function getBridgeKycLink(id: string): Promise<BridgeKycLink> {
  return bridgeRequest(`/kyc_links/${encodeURIComponent(id)}`);
}

export function identityStatusFromBridge(link: BridgeKycLink): IdentityStatus {
  if (["rejected", "offboarded", "paused"].includes(link.kyc_status)) return "unavailable";
  if (["awaiting_questionnaire", "awaiting_ubo"].includes(link.kyc_status)) return "needs_information";
  if (link.tos_status !== "approved") return "terms_pending";
  if (link.kyc_status === "approved" && link.customer_id) return "approved";
  if (link.kyc_status === "under_review") return "pending";
  return "started";
}
