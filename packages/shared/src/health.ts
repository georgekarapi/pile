import type { Health, HealthStatus } from "./types.js";

export const BPS = 10_000;

export type HealthInput = {
  collateralUsd: number;
  debtUsd: number;
  walletUsdcUsd: number;
  effectiveMaxLtvBps: number;
  liquidationLtvBps: number;
  observedAt?: Date;
  stale?: boolean;
};

const money = (value: number) => Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);

export function computeHealth(input: HealthInput): Health {
  const collateralUsd = money(input.collateralUsd);
  const debtUsd = money(input.debtUsd);
  const walletUsdcUsd = money(input.walletUsdcUsd);
  const effectiveMaxLtvBps = Math.max(0, Math.floor(input.effectiveMaxLtvBps));
  const liquidationLtvBps = Math.max(effectiveMaxLtvBps, Math.floor(input.liquidationLtvBps));
  const safeCeilingLtvBps = Math.min(3500, Math.floor(effectiveMaxLtvBps * 0.5));
  const operatingLtvBps = Math.floor(safeCeilingLtvBps * 0.85);
  const currentLtvBps = collateralUsd === 0 ? (debtUsd > 0 ? BPS : 0) : Math.floor((debtUsd / collateralUsd) * BPS);
  const desiredDebtUsd = money((collateralUsd * operatingLtvBps) / BPS);
  const additionalBorrowUsd = money(desiredDebtUsd - debtUsd);
  const safeCeilingDebtUsd = (collateralUsd * safeCeilingLtvBps) / BPS;
  const requiredRepayReserveUsd = money(debtUsd - safeCeilingDebtUsd);
  const cardAvailableUsd = money(walletUsdcUsd - requiredRepayReserveUsd);

  let status: HealthStatus = "healthy";
  if (input.stale) status = "stale";
  else if (currentLtvBps >= liquidationLtvBps * 0.8) status = "critical";
  else if (currentLtvBps >= safeCeilingLtvBps) status = "warning";

  return {
    collateralUsd,
    debtUsd,
    walletUsdcUsd,
    currentLtvBps,
    effectiveMaxLtvBps,
    liquidationLtvBps,
    safeCeilingLtvBps,
    operatingLtvBps,
    desiredDebtUsd,
    additionalBorrowUsd,
    cardAvailableUsd: status === "healthy" ? cardAvailableUsd : 0,
    requiredRepayReserveUsd,
    status,
    observedAt: (input.observedAt ?? new Date()).toISOString()
  };
}
