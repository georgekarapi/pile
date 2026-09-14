import type { BasketWeight } from "./types.js";

export const ALLOWED_AMOUNTS = [30, 50, 100] as const;

export function assertPlanInput(amountUsd: number, weights: BasketWeight[]): asserts amountUsd is 30 | 50 | 100 {
  if (!ALLOWED_AMOUNTS.includes(amountUsd as 30 | 50 | 100)) throw new Error("Unsupported weekly contribution");
  if (weights.length < 2 || weights.length > 3) throw new Error("A basket needs two or three assets");
  if (weights.reduce((total, weight) => total + weight.bps, 0) !== 10_000) throw new Error("Weights must total 10,000 bps");
  for (const weight of weights) {
    if (!weight.mint || !weight.symbol || weight.bps <= 0) throw new Error("Invalid basket weight");
  }
}

export function splitAtomicAmount(total: bigint, weights: BasketWeight[]): bigint[] {
  const allocations = weights.map((weight) => (total * BigInt(weight.bps)) / 10_000n);
  const remainder = total - allocations.reduce((sum, amount) => sum + amount, 0n);
  const largestIndex = weights.reduce((winner, weight, index) => weight.bps > weights[winner].bps ? index : winner, 0);
  allocations[largestIndex] += remainder;
  return allocations;
}
