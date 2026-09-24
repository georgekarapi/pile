import type { TransactionKind, UnsignedTransaction } from "./ports.js";

export type TransactionPolicy = {
  owner: string;
  allowedKinds: TransactionKind[];
  allowedProgramIds: string[];
  allowedMints: string[];
  allowedRecipients: string[];
  maxInputAtomic: bigint;
};

export function assertTransactionWithinPolicy(transaction: UnsignedTransaction, policy: TransactionPolicy): void {
  const { intent } = transaction;
  if (intent.owner !== policy.owner) throw new Error("Transaction owner does not match signer policy");
  if (!policy.allowedKinds.includes(intent.kind)) throw new Error(`Transaction kind ${intent.kind} is not allowed`);
  if (intent.programIds.some((program) => !policy.allowedProgramIds.includes(program))) throw new Error("Transaction includes an unapproved program");
  if (intent.mints.some((mint) => !policy.allowedMints.includes(mint))) throw new Error("Transaction includes an unapproved mint");
  if ((intent.inputAtomic ?? 0n) > policy.maxInputAtomic) throw new Error("Transaction exceeds the contribution-cycle input cap");
  if (intent.kind === "borrow" && (intent.recipients.length !== 1 || intent.recipients[0] !== policy.owner)) throw new Error("Borrow proceeds must return to the user wallet");
  if (intent.recipients.some((recipient) => !policy.allowedRecipients.includes(recipient))) throw new Error("Transaction includes an unapproved recipient");
}
