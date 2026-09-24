import type { BasketWeight, Health } from "./types.js";

export type TransactionKind = "swap" | "deposit" | "borrow" | "repay" | "bridge_delegate";

export type UnsignedTransaction = {
  serialized: string;
  summary: string;
  intent: {
    kind: TransactionKind;
    owner: string;
    programIds: string[];
    mints: string[];
    inputAtomic?: bigint;
    recipients: string[];
  };
  execution?: { provider: "jupiter"; requestId: string; lastValidBlockHeight?: number };
};

export type SignedTransaction = { signature: string; serialized: string };
export type SubmittedTransaction = { signature: string };

export interface WalletPort {
  getAddress(userId: string): Promise<string>;
  getUsdcBalance(address: string): Promise<number>;
  signScoped(userId: string, transaction: UnsignedTransaction): Promise<SignedTransaction>;
}

export interface SwapPort {
  buildSwap(input: { owner: string; inputUsdcAtomic: bigint; outputMint: string }): Promise<UnsignedTransaction>;
  execute(input: { transaction: UnsignedTransaction; signed: SignedTransaction }): Promise<{ signature: string; outputAtomic?: bigint }>;
}

export interface LendPort {
  buildDeposit(input: { owner: string; mint: string; amountAtomic: bigint }): Promise<UnsignedTransaction>;
  buildBorrowUsdc(input: { owner: string; amountAtomic: bigint }): Promise<UnsignedTransaction>;
  buildRepayUsdc(input: { owner: string; amountAtomic: bigint }): Promise<UnsignedTransaction>;
  submit(input: { transaction: UnsignedTransaction; signed: SignedTransaction }): Promise<SubmittedTransaction>;
  confirm(signature: string): Promise<void>;
  getHealth(owner: string): Promise<Health>;
}

export interface FundingPort {
  creditDemoUsdc(input: { userId: string; destination: string; amountUsd: number; idempotencyKey: string }): Promise<{ signature: string; atomicAmount: bigint }>;
}

export interface CardPort {
  createKycSession(userId: string): Promise<{ url: string }>;
  provision(userId: string, owner: string): Promise<{ cardAccountId: string; approvalTransaction: UnsignedTransaction }>;
  freeze(userId: string, frozen: boolean): Promise<void>;
}
