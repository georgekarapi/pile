import type { CardPort, FundingPort, LendPort, SwapPort, WalletPort } from "@pileup/shared";
import { config } from "../config.js";
import { DemoCardAdapter, DemoFundingAdapter, DemoLendAdapter, DemoSwapAdapter, DemoWalletAdapter } from "./demo.js";
import { JupiterSwapAdapter } from "./jupiter.js";

export type ProviderSet = {
  wallet: WalletPort;
  funding: FundingPort;
  swap: SwapPort;
  lend: LendPort;
  card: CardPort;
  mode: "demo" | "live";
  /** The exact mint that transaction policy must allow as the borrowed asset. */
  usdcMint: string;
};

/**
 * Keeps all mode selection in one place. Live-only adapters are deliberately
 * unavailable until their provider-specific signer, Kamino, Bridge, and treasury
 * configuration are installed; this prevents a live request from falling back to
 * a simulated money movement.
 */
export function providers(): ProviderSet {
  if (config.PILEUP_MODE === "demo") return {
    wallet: new DemoWalletAdapter(), funding: new DemoFundingAdapter(), swap: new DemoSwapAdapter(), lend: new DemoLendAdapter(), card: new DemoCardAdapter(), usdcMint: "USDC", mode: "demo"
  };
  throw new Error("Live provider set requires the Privy, treasury, Kamino, and Bridge adapters to be configured");
}

export function liveJupiterSwap(): SwapPort {
  if (config.PILEUP_MODE !== "live") throw new Error("Jupiter live adapter is unavailable in demo mode");
  return new JupiterSwapAdapter();
}
