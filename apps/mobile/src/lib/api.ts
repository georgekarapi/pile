import type { Health, Plan } from "@pileup/shared";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5001/YOUR_PROJECT/europe-west1/api";
const demoUser = process.env.EXPO_PUBLIC_DEMO_USER_ID ?? "demo-user";
let accessTokenProvider: (() => Promise<string | null>) | undefined;

export function setAccessTokenProvider(provider: () => Promise<string | null>) {
  accessTokenProvider = provider;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await accessTokenProvider?.();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : { "x-pileup-demo-user": demoUser }),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({ error: "Request failed" }))).error);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function mutation<T>(path: string, init: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    headers: { "Idempotency-Key": crypto.randomUUID(), ...(init.headers ?? {}) }
  });
}

export const api = {
  createPlan: (amountUsd: 30 | 50 | 100) => mutation<{ plan: Plan }>("/v1/plans", { method: "POST", body: JSON.stringify({ amountUsd }) }),
  activatePlan: (id: string) => mutation<{ subscriptionId: string; customerId: string; clientSecret?: string; ephemeralKey?: string; mode: "demo" | "live" }>(`/v1/plans/${id}/activate`, { method: "POST" }),
  pausePlan: (id: string) => mutation<void>(`/v1/plans/${id}/pause`, { method: "POST" }),
  pile: () => request<{ address: string; health: Health; source: "demo" | "live" }>("/v1/pile"),
  health: () => request<Health>("/v1/health"),
  kyc: () => mutation<{ url: string }>("/v1/bridge/kyc-session", { method: "POST" }),
  card: () => mutation<{ card: { bridgeCardAccountId: string } }>("/v1/cards", { method: "POST" }),
  freezeCard: (cardId: string, frozen: boolean) => mutation<void>(`/v1/cards/${cardId}/freeze`, { method: "POST", body: JSON.stringify({ frozen }) }),
  repay: (amountUsd: number) => mutation<{ signature: string; amountUsd: number }>("/v1/debt/repay", { method: "POST", body: JSON.stringify({ amountUsd }) })
};
