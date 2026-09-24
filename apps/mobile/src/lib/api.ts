import type { CardRecord, FundingCycle, Health, Plan } from "@pile/shared";
import Constants from "expo-constants";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5001/YOUR_PROJECT/europe-west1/api";
const demoUser = process.env.EXPO_PUBLIC_DEMO_USER_ID ?? "demo-user";
let accessTokenProvider: (() => Promise<string | null>) | undefined;

export function setAccessTokenProvider(provider: () => Promise<string | null>) {
  accessTokenProvider = provider;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await accessTokenProvider?.();
  const expoGoPreview = Constants.appOwnership === "expo";
  if (!accessToken && !expoGoPreview) throw new Error("Sign in to continue.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : { "x-pile-demo-user": demoUser }),
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
  createPlan: (amountUsd: number, mix: "balanced" | "market" | "tech") => mutation<{ plan: Plan }>("/v1/plans", { method: "POST", body: JSON.stringify({ amountUsd, mix }) }),
  changePlan: (id: string, amountUsd: number, mix: "balanced" | "market" | "tech", expectedUpdatedAt: string) => mutation<{ plan: Plan }>(`/v1/plans/${id}`, { method: "PATCH", headers: { "Idempotency-Key": `plan-change-${id}-${expectedUpdatedAt}-${amountUsd}-${mix}` }, body: JSON.stringify({ amountUsd, mix, expectedUpdatedAt }) }),
  currentPlan: () => request<{ plan: Plan | null }>("/v1/plans/current"),
  paymentMethodSession: () => mutation<{ url: string }>("/v1/billing/payment-method-session", { method: "POST" }),
  syncPaymentMethod: () => mutation<{ changed: boolean }>("/v1/billing/payment-method-sync", { method: "POST" }),
  latestFundingCycle: () => request<{ cycle: FundingCycle | null }>("/v1/funding/latest"),
  activatePlan: (id: string) => mutation<{ subscriptionId: string; customerId: string; clientSecret?: string; ephemeralKey?: string; mode: "demo" | "live" }>(`/v1/plans/${id}/activate`, { method: "POST", headers: { "Idempotency-Key": `activate-plan-${id}` } }),
  retryCheckout: () => mutation<{ subscriptionId: string; customerId: string; clientSecret?: string; ephemeralKey?: string; mode: "demo" | "live" }>("/v1/billing/retry-checkout", { method: "POST" }),
  pausePlan: (id: string, expectedUpdatedAt: string) => mutation<void>(`/v1/plans/${id}/pause`, { method: "POST", headers: { "Idempotency-Key": `pause-plan-${id}-${expectedUpdatedAt}` }, body: JSON.stringify({ expectedUpdatedAt }) }),
  resumePlan: (id: string, expectedUpdatedAt: string) => mutation<void>(`/v1/plans/${id}/resume`, { method: "POST", headers: { "Idempotency-Key": `resume-plan-${id}-${expectedUpdatedAt}` }, body: JSON.stringify({ expectedUpdatedAt }) }),
  pile: () => request<{ address: string; health: Health; source: "demo" | "live" }>("/v1/pile"),
  health: () => request<Health>("/v1/health"),
  kyc: (fullName?: string, email?: string) => mutation<{ tosUrl: string; kycUrl: string; status: "not_started" | "terms_pending" | "started" | "pending" | "needs_information" | "approved" | "unavailable" }>("/v1/bridge/kyc-session", { method: "POST", body: JSON.stringify(fullName && email ? { fullName, email } : {}) }),
  identityStatus: () => request<{ status: "not_started" | "terms_pending" | "started" | "pending" | "approved" | "needs_information" | "unavailable" }>("/v1/identity/status"),
  currentCard: () => request<{ card: CardRecord | null }>("/v1/cards/current"),
  card: () => mutation<{ card: CardRecord }>("/v1/cards", { method: "POST" }),
  freezeCard: (cardId: string, frozen: boolean) => mutation<void>(`/v1/cards/${cardId}/freeze`, { method: "POST", body: JSON.stringify({ frozen }) }),
  repay: (amountUsd: number) => mutation<{ signature: string; amountUsd: number }>("/v1/debt/repay", { method: "POST", body: JSON.stringify({ amountUsd }) })
};
