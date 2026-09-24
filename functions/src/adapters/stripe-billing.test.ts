import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRetrieve = vi.fn();
const mockSubscriptionsCreate = vi.fn();
const mockEphemeralKeysCreate = vi.fn();
const mockPaymentIntentsRetrieve = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      subscriptions = {
        retrieve: mockRetrieve,
        create: mockSubscriptionsCreate,
        update: vi.fn()
      };
      ephemeralKeys = {
        create: mockEphemeralKeysCreate
      };
      paymentIntents = {
        retrieve: mockPaymentIntentsRetrieve
      };
      customers = {
        create: vi.fn(),
        retrieve: vi.fn()
      };
      billingPortal = {
        sessions: {
          create: vi.fn()
        }
      };
      prices = {
        create: vi.fn()
      };
    }
  };
});

vi.mock("../config.js", () => ({
  config: {
    PILE_MODE: "live",
    STRIPE_SECRET_KEY: "sk_test_mock",
    PILE_STRIPE_PRODUCT_ID: "prod_123"
  }
}));

const { getBillingSubscriptionCheckout } = await import("./stripe-billing.js");

describe("stripe billing checkout recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEphemeralKeysCreate.mockResolvedValue({ secret: "ephkey_mock" });
  });

  it("retrieves confirmation secret from invoice confirmation_secret", async () => {
    mockRetrieve.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      metadata: { pileUserId: "user_1", pilePlanId: "plan_1" },
      items: { data: [{ price: { id: "price_1" } }] },
      latest_invoice: {
        id: "in_1",
        confirmation_secret: { client_secret: "cs_from_conf_secret" }
      }
    });

    const res = await getBillingSubscriptionCheckout({
      subscriptionId: "sub_123",
      userId: "user_1",
      planId: "plan_1"
    });

    expect(res.clientSecret).toBe("cs_from_conf_secret");
    expect(res.ephemeralKey).toBe("ephkey_mock");
    expect(res.customerId).toBe("cus_123");
  });

  it("falls back to payment_intent client secret when confirmation_secret is missing", async () => {
    mockRetrieve.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      metadata: { pileUserId: "user_1", pilePlanId: "plan_1" },
      items: { data: [{ price: { id: "price_1" } }] },
      latest_invoice: {
        id: "in_1",
        confirmation_secret: null,
        payment_intent: { client_secret: "cs_from_payment_intent" }
      }
    });

    const res = await getBillingSubscriptionCheckout({
      subscriptionId: "sub_123",
      userId: "user_1",
      planId: "plan_1"
    });

    expect(res.clientSecret).toBe("cs_from_payment_intent");
  });

  it("retrieves payment_intent by string ID if payment_intent was not expanded", async () => {
    mockRetrieve.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      metadata: { pileUserId: "user_1", pilePlanId: "plan_1" },
      items: { data: [{ price: { id: "price_1" } }] },
      latest_invoice: {
        id: "in_1",
        confirmation_secret: null,
        payment_intent: "pi_123"
      }
    });
    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: "pi_123",
      client_secret: "cs_from_pi_retrieve"
    });

    const res = await getBillingSubscriptionCheckout({
      subscriptionId: "sub_123",
      userId: "user_1",
      planId: "plan_1"
    });

    expect(res.clientSecret).toBe("cs_from_pi_retrieve");
    expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith("pi_123");
  });

  it("rejects checkout if subscription metadata does not match user and plan", async () => {
    mockRetrieve.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      metadata: { pileUserId: "different_user", pilePlanId: "plan_1" }
    });

    await expect(
      getBillingSubscriptionCheckout({
        subscriptionId: "sub_123",
        userId: "user_1",
        planId: "plan_1"
      })
    ).rejects.toThrow("Stripe subscription does not match this plan");
  });
});
