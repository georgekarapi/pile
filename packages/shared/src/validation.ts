import type { BasketWeight } from "./types.js";

export const MIN_WEEKLY_AMOUNT_USD = 10;
export const MAX_WEEKLY_AMOUNT_USD = 150;
export const WEEKLY_AMOUNT_STEP_USD = 5;

export function assertPlanInput(amountUsd: number, weights: BasketWeight[]): void {
  if (!Number.isSafeInteger(amountUsd) || amountUsd < MIN_WEEKLY_AMOUNT_USD || amountUsd > MAX_WEEKLY_AMOUNT_USD || amountUsd % WEEKLY_AMOUNT_STEP_USD !== 0) throw new Error("Weekly contribution must be $10–$150 in $5 steps");
  if (weights.length < 1 || weights.length > 10) throw new Error("A basket needs one to ten assets");
  if (weights.reduce((total, weight) => total + weight.bps, 0) !== 10_000) throw new Error("Weights must total 10,000 bps");
  if (new Set(weights.map((weight) => weight.mint)).size !== weights.length) throw new Error("A basket cannot include the same asset twice");
  for (const weight of weights) {
    if (!weight.mint || !weight.symbol || !Number.isSafeInteger(weight.bps) || weight.bps <= 0) throw new Error("Invalid basket weight");
  }
}

export function splitAtomicAmount(total: bigint, weights: BasketWeight[]): bigint[] {
  const allocations = weights.map((weight) => (total * BigInt(weight.bps)) / 10_000n);
  const remainder = total - allocations.reduce((sum, amount) => sum + amount, 0n);
  const largestIndex = weights.reduce((winner, weight, index) => weight.bps > weights[winner].bps ? index : winner, 0);
  allocations[largestIndex] += remainder;
  return allocations;
}
