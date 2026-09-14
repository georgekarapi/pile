import { describe, expect, it } from "vitest";
import { DemoCardAdapter, DemoFundingAdapter, DemoLendAdapter, DemoSwapAdapter, DemoWalletAdapter } from "./demo.js";

describe("demo adapters", () => {
  it("does not credit treasury USDC unless explicitly enabled", async () => {
    await expect(new DemoFundingAdapter().creditDemoUsdc({ userId: "u1", destination: "wallet", amountUsd: 30, idempotencyKey: "invoice_1" })).rejects.toThrow("Demo treasury is disabled");
  });

  it("only produces transaction-shaped objects for swap, deposit, and card approval", async () => {
    const wallet = new DemoWalletAdapter();
    const swap = await new DemoSwapAdapter().buildSwap({ owner: await wallet.getAddress("u1"), inputUsdcAtomic: 30_000_000n, outputMint: "SPYx" });
    const deposit = await new DemoLendAdapter().deposit({ owner: "wallet", mint: "SPYx", amountAtomic: 10n });
    const card = await new DemoCardAdapter().provision("u1", "wallet");
    expect(swap.serialized).toBeTruthy();
    expect(deposit.summary).toContain("Kamino");
    expect(card.approvalTransaction.summary).toContain("Bridge");
  });

  it("turns deposited demo collateral into a conservative borrow buffer", async () => {
    const lend = new DemoLendAdapter();
    await lend.deposit({ owner: "health-wallet", mint: "SPYx", amountAtomic: 30_000_000n });
    const beforeBorrow = await lend.getHealth("health-wallet");
    await lend.borrowUsdc({ owner: "health-wallet", amountAtomic: BigInt(Math.floor(beforeBorrow.additionalBorrowUsd * 1_000_000)) });
    const afterBorrow = await lend.getHealth("health-wallet");
    expect(afterBorrow.collateralUsd).toBe(30);
    expect(afterBorrow.debtUsd).toBeGreaterThan(0);
    expect(afterBorrow.cardAvailableUsd).toBeGreaterThan(0);
  });

  it("repays from wallet USDC without selling collateral", async () => {
    const lend = new DemoLendAdapter();
    await lend.deposit({ owner: "repay-wallet", mint: "SPYx", amountAtomic: 30_000_000n });
    const beforeBorrow = await lend.getHealth("repay-wallet");
    await lend.borrowUsdc({ owner: "repay-wallet", amountAtomic: BigInt(Math.floor(beforeBorrow.additionalBorrowUsd * 1_000_000)) });
    const beforeRepay = await lend.getHealth("repay-wallet");
    const repay = await lend.repayUsdc({ owner: "repay-wallet", amountAtomic: 1_000_000n });
    const afterRepay = await lend.getHealth("repay-wallet");
    expect(repay.intent.kind).toBe("repay");
    expect(afterRepay.collateralUsd).toBe(beforeRepay.collateralUsd);
    expect(afterRepay.debtUsd).toBeLessThan(beforeRepay.debtUsd);
  });
});
