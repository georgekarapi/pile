import { assertTransactionWithinPolicy, splitAtomicAmount, type TransactionPolicy } from "@pile/shared";
import type { FundingCycle, FundingPort, LendPort, SwapPort, WalletPort } from "@pile/shared";
import { saveCycle } from "../repository.js";

export type FundingDependencies = { wallet: WalletPort; funding: FundingPort; swap: SwapPort; lend: LendPort; usdcMint: string };

export async function runFundingCycle(cycle: FundingCycle, plan: { userId: string; weights: { mint: string; symbol: string; bps: number }[] }, deps: FundingDependencies): Promise<FundingCycle> {
  if (cycle.state === "needs_attention" && cycle.resumeState) cycle.state = cycle.resumeState;
  const snapshotWeights = cycle.legs.every((leg) => Number.isSafeInteger(leg.bps) && Number(leg.bps) > 0)
    ? cycle.legs.map((leg) => ({ mint: leg.mint, symbol: leg.symbol, bps: Number(leg.bps) }))
    : plan.weights.length === cycle.legs.length && plan.weights.every((weight, index) => weight.mint === cycle.legs[index].mint && weight.symbol === cycle.legs[index].symbol)
      ? plan.weights
      : undefined;
  if (!snapshotWeights || snapshotWeights.reduce((sum, weight) => sum + weight.bps, 0) !== 10_000) throw new Error("Funding cycle has no matching immutable allocation");
  const owner = await deps.wallet.getAddress(plan.userId);
  const policy: TransactionPolicy = {
    owner,
    allowedKinds: ["swap", "deposit", "borrow"],
    allowedProgramIds: ["jupiter-ultra", "kamino", "spl-token", "compute-budget"],
    allowedMints: [deps.usdcMint, ...snapshotWeights.map((weight) => weight.mint)],
    allowedRecipients: [owner, "kamino"],
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
      const allocations = splitAtomicAmount(inputTotal, snapshotWeights);
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

    if (cycle.state === "depositing" || cycle.state === "deposits_submitted") {
      for (const [index, leg] of cycle.legs.entries()) {
        if (!leg.outputAtomic) throw new Error(`No output for ${leg.symbol}`);
        const existingSignature = cycle.depositSignatures[index];
        if (existingSignature) {
          await deps.lend.confirm(existingSignature);
          continue;
        }
        const unsigned = await deps.lend.buildDeposit({ owner, mint: leg.mint, amountAtomic: BigInt(leg.outputAtomic) });
        assertTransactionWithinPolicy(unsigned, policy);
        const signed = await deps.wallet.signScoped(plan.userId, unsigned);
        const submitted = await deps.lend.submit({ transaction: unsigned, signed });
        cycle.depositSignatures[index] = submitted.signature;
        cycle.state = "deposits_submitted";
        await saveCycle(cycle);
        await deps.lend.confirm(submitted.signature);
      }
      cycle.state = "borrowing";
      await saveCycle(cycle);
    }

    if (cycle.state === "borrowing" || cycle.state === "borrow_submitted") {
      if (cycle.borrowSignature) {
        await deps.lend.confirm(cycle.borrowSignature);
        cycle.state = "complete";
        await saveCycle(cycle);
        return cycle;
      }
      const health = await deps.lend.getHealth(owner);
      if (health.additionalBorrowUsd > 0) {
        const unsigned = await deps.lend.buildBorrowUsdc({ owner, amountAtomic: BigInt(Math.floor(health.additionalBorrowUsd * 1_000_000)) });
        assertTransactionWithinPolicy(unsigned, policy);
        const signed = await deps.wallet.signScoped(plan.userId, unsigned);
        const submitted = await deps.lend.submit({ transaction: unsigned, signed });
        cycle.borrowSignature = submitted.signature;
        cycle.state = "borrow_submitted";
        await saveCycle(cycle);
        await deps.lend.confirm(submitted.signature);
      }
      cycle.state = "complete";
      await saveCycle(cycle);
    }
  } catch (error) {
    if (cycle.state !== "needs_attention") cycle.resumeState = cycle.state;
    cycle.state = "needs_attention";
    cycle.attempts += 1;
    cycle.lastError = error instanceof Error ? error.message : "Unknown workflow error";
    await saveCycle(cycle);
    throw error;
  }
  return cycle;
}
