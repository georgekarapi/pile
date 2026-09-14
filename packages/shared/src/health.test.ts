import { describe, expect, it } from "vitest";
import { computeHealth } from "./health.js";
import { splitAtomicAmount } from "./validation.js";
import { assertTransactionWithinPolicy } from "./transaction-policy.js";

describe("computeHealth", () => {
  it("keeps the card buffer separate from remaining borrowing capacity", () => {
    const health = computeHealth({ collateralUsd: 100, debtUsd: 29.75, walletUsdcUsd: 29.75, effectiveMaxLtvBps: 7000, liquidationLtvBps: 8000 });
    expect(health.operatingLtvBps).toBe(2975);
    expect(health.additionalBorrowUsd).toBe(0);
    expect(health.cardAvailableUsd).toBe(29.75);
  });

  it("freezes available card value when risk reaches the safe ceiling", () => {
    const health = computeHealth({ collateralUsd: 100, debtUsd: 35, walletUsdcUsd: 35, effectiveMaxLtvBps: 7000, liquidationLtvBps: 8000 });
    expect(health.status).toBe("warning");
    expect(health.cardAvailableUsd).toBe(0);
  });
});

describe("transaction policy", () => {
  const policy = { owner: "user", allowedKinds: ["borrow"] as const, allowedProgramIds: ["kamino"], allowedMints: ["USDC"], maxInputAtomic: 1_000_000n };
  it("allows a scoped borrow only to the owner", () => {
    expect(() => assertTransactionWithinPolicy({ serialized: "x", summary: "borrow", intent: { kind: "borrow", owner: "user", programIds: ["kamino"], mints: ["USDC"], recipients: ["user"] } }, policy)).not.toThrow();
  });
  it("rejects a borrow sent anywhere else", () => {
    expect(() => assertTransactionWithinPolicy({ serialized: "x", summary: "borrow", intent: { kind: "borrow", owner: "user", programIds: ["kamino"], mints: ["USDC"], recipients: ["attacker"] } }, policy)).toThrow("Borrow proceeds");
  });
  it("enforces an exact input cap for repayment", () => {
    const repayPolicy = { owner: "user", allowedKinds: ["repay"] as const, allowedProgramIds: ["kamino", "spl-token"], allowedMints: ["USDC"], maxInputAtomic: 1_000_000n };
    expect(() => assertTransactionWithinPolicy({ serialized: "x", summary: "repay", intent: { kind: "repay", owner: "user", programIds: ["kamino", "spl-token"], mints: ["USDC"], inputAtomic: 1_000_000n, recipients: ["kamino"] } }, repayPolicy)).not.toThrow();
    expect(() => assertTransactionWithinPolicy({ serialized: "x", summary: "repay", intent: { kind: "repay", owner: "user", programIds: ["kamino", "spl-token"], mints: ["USDC"], inputAtomic: 1_000_001n, recipients: ["kamino"] } }, repayPolicy)).toThrow("exceeds");
  });
});

describe("splitAtomicAmount", () => {
  it("conserves every atomic unit", () => {
    const output = splitAtomicAmount(100n, [
      { symbol: "SPYx", mint: "spy", bps: 4000 },
      { symbol: "NVDAx", mint: "nvda", bps: 3000 },
      { symbol: "AAPLx", mint: "aapl", bps: 3000 }
    ]);
    expect(output).toEqual([40n, 30n, 30n]);
  });
});
