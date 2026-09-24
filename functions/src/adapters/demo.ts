import type { CardPort, FundingPort, LendPort, SwapPort, TransactionKind, UnsignedTransaction, WalletPort } from "@pileup/shared";
import { computeHealth } from "@pileup/shared";
import { config } from "../config.js";
import { reserveDemoCredit } from "../repository.js";

const transaction = (input: { summary: string; kind: TransactionKind; owner: string; programIds: string[]; mints: string[]; inputAtomic?: bigint; recipients?: string[] }): UnsignedTransaction => ({
  serialized: Buffer.from(JSON.stringify({ summary: input.summary, intent: { ...input, recipients: input.recipients ?? [] } }, (_key, value) => typeof value === "bigint" ? value.toString() : value)).toString("base64"),
  summary: input.summary,
  intent: { kind: input.kind, owner: input.owner, programIds: input.programIds, mints: input.mints, inputAtomic: input.inputAtomic, recipients: input.recipients ?? [] }
});

export class DemoWalletAdapter implements WalletPort {
  async getAddress(userId: string) { return `demo-wallet-${userId}`; }
  async getUsdcBalance(_address: string) { return 0; }
  async signScoped(_userId: string, unsigned: UnsignedTransaction) {
    return { signature: `demo-signature-${Buffer.from(unsigned.summary).toString("hex").slice(0, 24)}`, serialized: unsigned.serialized };
  }
}

export class DemoFundingAdapter implements FundingPort {
  async creditDemoUsdc(input: { userId: string; destination: string; amountUsd: number; idempotencyKey: string }) {
    if (config.PILEUP_MODE !== "demo" || config.PILEUP_TREASURY_ENABLED !== "true") throw new Error("Demo treasury is disabled");
    await reserveDemoCredit({
      userId: input.userId,
      cycleId: input.idempotencyKey,
      amountUsd: input.amountUsd,
      globalCapUsd: config.PILEUP_DEMO_GLOBAL_CAP_USD,
      walletCapUsd: config.PILEUP_DEMO_WALLET_CAP_USD
    });
    return { signature: `demo-credit-${input.idempotencyKey}`, atomicAmount: BigInt(Math.round(input.amountUsd * 1_000_000)) };
  }
}

export class DemoSwapAdapter implements SwapPort {
  async buildSwap(input: { owner: string; outputMint: string; inputUsdcAtomic: bigint }) {
    return transaction({ summary: `Swap ${input.inputUsdcAtomic} USDC atomic units to ${input.outputMint} for ${input.owner}`, kind: "swap", owner: input.owner, programIds: ["jupiter-ultra", "spl-token", "compute-budget"], mints: ["USDC", input.outputMint], inputAtomic: input.inputUsdcAtomic, recipients: [input.owner] });
  }
  async execute(input: { transaction: UnsignedTransaction; signed: { signature: string } }) {
    return { signature: input.signed.signature, outputAtomic: input.transaction.intent.inputAtomic };
  }
}

export class DemoLendAdapter implements LendPort {
  private static readonly positions = new Map<string, { collateralUsd: number; debtUsd: number; walletUsdcUsd: number }>();

  private position(owner: string) {
    const existing = DemoLendAdapter.positions.get(owner);
    if (existing) return existing;
    const created = { collateralUsd: 0, debtUsd: 0, walletUsdcUsd: 0 };
    DemoLendAdapter.positions.set(owner, created);
    return created;
  }

  async buildDeposit(input: { owner: string; mint: string; amountAtomic: bigint }) {
    return transaction({ summary: `Deposit ${input.amountAtomic} of ${input.mint} into Kamino for ${input.owner}`, kind: "deposit", owner: input.owner, programIds: ["kamino", "spl-token", "compute-budget"], mints: [input.mint], inputAtomic: input.amountAtomic, recipients: ["kamino"] });
  }

  async buildBorrowUsdc(input: { owner: string; amountAtomic: bigint }) {
    return transaction({ summary: `Borrow ${input.amountAtomic} USDC atomic units from Kamino for ${input.owner}`, kind: "borrow", owner: input.owner, programIds: ["kamino", "spl-token", "compute-budget"], mints: ["USDC"], inputAtomic: input.amountAtomic, recipients: [input.owner] });
  }

  async buildRepayUsdc(input: { owner: string; amountAtomic: bigint }) {
    return transaction({ summary: `Repay ${input.amountAtomic} USDC atomic units to Kamino for ${input.owner}`, kind: "repay", owner: input.owner, programIds: ["kamino", "spl-token", "compute-budget"], mints: ["USDC"], inputAtomic: input.amountAtomic, recipients: ["kamino"] });
  }

  async submit(input: { transaction: UnsignedTransaction; signed: { signature: string } }) {
    const intent = input.transaction.intent;
    const amountUsd = Number(intent.inputAtomic ?? 0n) / 1_000_000;
    const position = this.position(intent.owner);
    if (intent.kind === "deposit") position.collateralUsd += amountUsd;
    if (intent.kind === "borrow") {
      position.debtUsd += amountUsd;
      position.walletUsdcUsd += amountUsd;
    }
    if (intent.kind === "repay") {
      if (amountUsd > position.debtUsd + 0.000001 || amountUsd > position.walletUsdcUsd + 0.000001) throw new Error("Demo repayment exceeds current debt or wallet USDC");
      position.debtUsd = Math.max(0, position.debtUsd - amountUsd);
      position.walletUsdcUsd = Math.max(0, position.walletUsdcUsd - amountUsd);
    }
    return { signature: input.signed.signature };
  }

  async confirm(_signature: string) { return; }

  async getHealth(owner: string) {
    const position = this.position(owner);
    return computeHealth({ ...position, effectiveMaxLtvBps: 7000, liquidationLtvBps: 8000 });
  }
}

export class DemoCardAdapter implements CardPort {
  async createKycSession(_userId: string) { return { url: "https://example.invalid/bridge-kyc-demo" }; }
  async provision(_userId: string, owner: string) { return { cardAccountId: `demo-card-${owner}`, approvalTransaction: transaction({ summary: "Approve Bridge card program delegate", kind: "bridge_delegate", owner, programIds: ["bridge-card", "spl-token"], mints: ["USDC"], inputAtomic: 100_000_000n, recipients: ["bridge-card"] }) }; }
  async freeze(_userId: string, _frozen: boolean) { return; }
}
