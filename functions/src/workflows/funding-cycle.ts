import { assertTransactionWithinPolicy, splitAtomicAmount, type TransactionPolicy } from "@pileup/shared";
import type { FundingCycle, FundingPort, LendPort, SwapPort, WalletPort } from "@pileup/shared";
import { saveCycle } from "../repository.js";

export type FundingDependencies = { wallet: WalletPort; funding: FundingPort; swap: SwapPort; lend: LendPort; usdcMint: string };

export async function runFundingCycle(cycle: FundingCycle, plan: { userId: string; weights: { mint: string; symbol: string; bps: number }[] }, deps: FundingDependencies): Promise<FundingCycle> {
  const owner = await deps.wallet.getAddress(plan.userId);
  const policy: TransactionPolicy = {
    owner,
    allowedKinds: ["swap", "deposit", "borrow"],
    allowedProgramIds: ["jupiter-ultra", "kamino", "spl-token", "compute-budget"],
    allowedMints: [deps.usdcMint, ...plan.weights.map((weight) => weight.mint)],
    maxInputAtomic: BigInt(Math.round(cycle.expectedUsd * 1_000_000))
  };
  try {
    if (cycle.state === "invoice_paid" || cycle.state === "crediting") {
      cycle.state = "crediting";
      await saveCycle(cycle);
      const credit = await deps.funding.creditDemoUsdc({ userId: plan.userId, destination: owner, amountUsd: cycle.expectedUsd, idempotencyKey: cycle.id });
      cycle.creditSignature = credit.signature;
      cycle.creditUsdcAtomic = credit.atomicAmount.toString();
      cycle.state = "credited";
      await saveCycle(cycle);
    }

    const inputTotal = BigInt(cycle.creditUsdcAtomic ?? "0");
    if (cycle.state === "credited" || cycle.state === "swapping") {
      cycle.state = "swapping";
      const allocations = splitAtomicAmount(inputTotal, plan.weights);
      for (const [index, leg] of cycle.legs.entries()) {
        if (leg.status === "swapped") continue;
        const unsigned = await deps.swap.buildSwap({ owner, inputUsdcAtomic: allocations[index], outputMint: leg.mint });
        assertTransactionWithinPolicy(unsigned, policy);
        const signed = await deps.wallet.signScoped(plan.userId, unsigned);
        const execution = await deps.swap.execute({ transaction: unsigned, signed });
        leg.swapSignature = execution.signature;
        leg.outputAtomic = (execution.outputAtomic ?? allocations[index]).toString();
        leg.status = "swapped";
        await saveCycle(cycle);
      }
      cycle.state = "depositing";
      await saveCycle(cycle);
    }

    if (cycle.state === "depositing") {
      for (const leg of cycle.legs) {
        if (!leg.outputAtomic) throw new Error(`No output for ${leg.symbol}`);
        const unsigned = await deps.lend.deposit({ owner, mint: leg.mint, amountAtomic: BigInt(leg.outputAtomic) });
        assertTransactionWithinPolicy(unsigned, policy);
        const signed = await deps.wallet.signScoped(plan.userId, unsigned);
        if (!cycle.depositSignatures.includes(signed.signature)) cycle.depositSignatures.push(signed.signature);
        await saveCycle(cycle);
      }
      cycle.state = "borrowing";
      await saveCycle(cycle);
    }

    if (cycle.state === "borrowing") {
      const health = await deps.lend.getHealth(owner);
      if (health.additionalBorrowUsd > 0) {
        const unsigned = await deps.lend.borrowUsdc({ owner, amountAtomic: BigInt(Math.floor(health.additionalBorrowUsd * 1_000_000)) });
        assertTransactionWithinPolicy(unsigned, policy);
        cycle.borrowSignature = (await deps.wallet.signScoped(plan.userId, unsigned)).signature;
      }
      cycle.state = "complete";
      await saveCycle(cycle);
    }
  } catch (error) {
    cycle.state = "needs_attention";
    cycle.attempts += 1;
    cycle.lastError = error instanceof Error ? error.message : "Unknown workflow error";
    await saveCycle(cycle);
    throw error;
  }
  return cycle;
}
