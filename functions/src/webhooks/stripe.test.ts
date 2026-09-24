import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { Plan } from "@pile/shared";

vi.mock("firebase-admin/functions", () => ({
  getFunctions: () => ({
    taskQueue: () => ({
      enqueue: vi.fn().mockResolvedValue(undefined)
    })
  })
}));

const mockPlan: Plan = {
  id: "plan_123",
  userId: "user_abc",
  amountUsd: 50,
  interval: "week",
  weights: [
    { symbol: "SPYx", mint: "mint_spy", bps: 4000 },
    { symbol: "AAPLx", mint: "mint_aapl", bps: 3000 },
    { symbol: "NVDAx", mint: "mint_nvda", bps: 3000 }
  ],
  stripePriceId: "price_50",
  stripeSubscriptionId: "sub_123",
  status: "pending_payment",
  createdAt: "2026-09-24T12:00:00.000Z",
  updatedAt: "2026-09-24T12:00:00.000Z"
};

const repositoryMocks = {
  getPlan: vi.fn(),
  recordPlanPaymentIssue: vi.fn(),
  confirmPlanInvoicePayment: vi.fn(),
  cancelPlan: vi.fn(),
  claimWebhook: vi.fn(),
  updateWebhookState: vi.fn(),
  getCycle: vi.fn(),
  saveCycle: vi.fn()
};

vi.mock("../repository.js", () => repositoryMocks);

// Import stripeWebhook after mocks are configured
const { stripeWebhook } = await import("./stripe.js");

function createMockRes() {
  const res: Partial<Response> & { statusCode?: number; data?: unknown } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((data: unknown) => {
    res.data = data;
    return res;
  });
  return res as Response & { statusCode?: number; data?: unknown };
}

describe("stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMocks.getPlan.mockResolvedValue({ ...mockPlan });
    repositoryMocks.claimWebhook.mockResolvedValue("claimed");
    repositoryMocks.getCycle.mockResolvedValue(undefined);
    repositoryMocks.saveCycle.mockResolvedValue(undefined);
    repositoryMocks.updateWebhookState.mockResolvedValue(undefined);
    repositoryMocks.recordPlanPaymentIssue.mockResolvedValue(undefined);
    repositoryMocks.confirmPlanInvoicePayment.mockResolvedValue(undefined);
    repositoryMocks.cancelPlan.mockResolvedValue(undefined);
  });

  it("ignores irrelevant stripe events with 200", async () => {
    const req = { body: { id: "evt_other", type: "charge.captured" } } as Request;
    const res = createMockRes();
    await stripeWebhook(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual({ received: true, ignored: true });
  });

  it("rejects an invoice lacking immutable Pile subscription metadata", async () => {
    const req = {
      body: {
        id: "evt_1",
        type: "invoice.payment_failed",
        data: { object: { id: "in_1", collection_method: "charge_automatically", currency: "usd" } }
      }
    } as Request;
    const res = createMockRes();
    await stripeWebhook(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.data).toEqual({ error: "Invoice lacks immutable Pile subscription metadata" });
  });

  it("records payment failure and marks webhook processed on invoice.payment_failed", async () => {
    const req = {
      body: {
        id: "evt_failed",
        type: "invoice.payment_failed",
        livemode: false,
        created: 1774440000,
        data: {
          object: {
            id: "in_failed_1",
            collection_method: "charge_automatically",
            currency: "usd",
            subscription_details: {
              metadata: { pilePlanId: "plan_123", pileUserId: "user_abc" }
            },
            parent: {
              subscription_details: {
                subscription: "sub_123",
                metadata: { pilePlanId: "plan_123", pileUserId: "user_abc" }
              }
            }
          }
        }
      }
    } as Request;
    const res = createMockRes();
    await stripeWebhook(req, res);
    expect(res.statusCode).toBe(202);
    expect(repositoryMocks.recordPlanPaymentIssue).toHaveBeenCalledWith({
      planId: "plan_123",
      userId: "user_abc",
      subscriptionId: "sub_123",
      issue: expect.objectContaining({ invoiceId: "in_failed_1", kind: "failed" })
    });
    expect(repositoryMocks.updateWebhookState).toHaveBeenCalledWith("evt_failed", "stripe", "processed", {
      invoiceId: "in_failed_1",
      kind: "failed"
    });
  });

  it("records payment action required on invoice.payment_action_required", async () => {
    const req = {
      body: {
        id: "evt_action",
        type: "invoice.payment_action_required",
        livemode: false,
        created: 1774440000,
        data: {
          object: {
            id: "in_action_1",
            collection_method: "charge_automatically",
            currency: "usd",
            parent: {
              subscription_details: {
                subscription: "sub_123",
                metadata: { pilePlanId: "plan_123", pileUserId: "user_abc" }
              }
            }
          }
        }
      }
    } as Request;
    const res = createMockRes();
    await stripeWebhook(req, res);
    expect(res.statusCode).toBe(202);
    expect(repositoryMocks.recordPlanPaymentIssue).toHaveBeenCalledWith({
      planId: "plan_123",
      userId: "user_abc",
      subscriptionId: "sub_123",
      issue: expect.objectContaining({ invoiceId: "in_action_1", kind: "action_required" })
    });
  });

  it("confirms plan payment and starts cycle on invoice.payment_succeeded", async () => {
    const req = {
      body: {
        id: "evt_paid",
        type: "invoice.payment_succeeded",
        livemode: false,
        data: {
          object: {
            id: "in_paid_1",
            status: "paid",
            collection_method: "charge_automatically",
            currency: "usd",
            amount_paid: 5000,
            lines: { data: [{ price: { id: "price_50" } }] },
            parent: {
              subscription_details: {
                subscription: "sub_123",
                metadata: { pilePlanId: "plan_123", pileUserId: "user_abc" }
              }
            }
          }
        }
      }
    } as Request;
    const res = createMockRes();
    await stripeWebhook(req, res);
    expect(res.statusCode).toBe(202);
    expect(repositoryMocks.confirmPlanInvoicePayment).toHaveBeenCalledWith({
      planId: "plan_123",
      userId: "user_abc",
      subscriptionId: "sub_123",
      invoiceId: "in_paid_1"
    });
    expect(repositoryMocks.saveCycle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "in_paid_1",
        planId: "plan_123",
        expectedUsd: 50,
        state: "invoice_paid"
      })
    );
  });

  it("cancels plan when customer.subscription.deleted arrives", async () => {
    const req = {
      body: {
        id: "evt_sub_deleted",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_123",
            metadata: { pilePlanId: "plan_123", pileUserId: "user_abc" }
          }
        }
      }
    } as Request;
    const res = createMockRes();
    await stripeWebhook(req, res);
    expect(res.statusCode).toBe(202);
    expect(repositoryMocks.cancelPlan).toHaveBeenCalledWith({
      planId: "plan_123",
      userId: "user_abc",
      subscriptionId: "sub_123"
    });
  });
});
