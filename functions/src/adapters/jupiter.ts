import type { SwapPort, UnsignedTransaction } from "@pile/shared";
import { config } from "../config.js";

type JupiterOrder = {
  transaction: string | null;
  requestId: string;
  outAmount: string;
  lastValidBlockHeight?: number;
  errorCode?: number;
  errorMessage?: string;
};

type JupiterExecution = {
  status: "Success" | "Failed";
  signature: string;
  totalOutputAmount: string;
  error?: string;
};

/** Jupiter Swap V2 Meta-Aggregator adapter. Signing remains with Privy. */
export class JupiterSwapAdapter implements SwapPort {
  private readonly baseUrl = "https://api.jup.ag/swap/v2";

  async buildSwap(input: { owner: string; inputUsdcAtomic: bigint; outputMint: string }): Promise<UnsignedTransaction> {
    if (!config.JUPITER_API_KEY) throw new Error("JUPITER_API_KEY is required");
    const params = new URLSearchParams({ inputMint: config.PILE_USDC_MINT, outputMint: input.outputMint, amount: input.inputUsdcAtomic.toString(), taker: input.owner });
    const response = await fetch(`${this.baseUrl}/order?${params}`, { headers: { "x-api-key": config.JUPITER_API_KEY } });
    if (!response.ok) throw new Error(`Jupiter order failed: ${response.status} ${await response.text()}`);
    const order = await response.json() as JupiterOrder;
    if (!order.transaction) throw new Error(`Jupiter could not assemble swap: ${order.errorCode ?? "unknown"} ${order.errorMessage ?? ""}`.trim());
    return {
      serialized: order.transaction,
      summary: `Jupiter swap ${input.inputUsdcAtomic} USDC to ${input.outputMint}`,
      intent: {
        kind: "swap",
        owner: input.owner,
        // The assembled transaction is opaque to Jupiter's Meta-Aggregator. The
        // policy validator checks the request inputs; live deployments must also
        // decode the wire transaction against the expected taker/output accounts.
        programIds: ["jupiter-ultra", "spl-token", "compute-budget"],
        mints: [config.PILE_USDC_MINT, input.outputMint],
        inputAtomic: input.inputUsdcAtomic,
        recipients: [input.owner]
      },
      execution: { provider: "jupiter", requestId: order.requestId, lastValidBlockHeight: order.lastValidBlockHeight }
    };
  }

  async execute(input: { transaction: UnsignedTransaction; signed: { signature: string; serialized: string } }) {
    const execution = input.transaction.execution;
    if (!execution || execution.provider !== "jupiter") throw new Error("Missing Jupiter execution metadata");
    if (!config.JUPITER_API_KEY) throw new Error("JUPITER_API_KEY is required");
    const response = await fetch(`${this.baseUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": config.JUPITER_API_KEY },
      body: JSON.stringify({ signedTransaction: input.signed.serialized, requestId: execution.requestId, lastValidBlockHeight: execution.lastValidBlockHeight })
    });
    if (!response.ok) throw new Error(`Jupiter execute failed: ${response.status} ${await response.text()}`);
    const result = await response.json() as JupiterExecution;
    if (result.status !== "Success") throw new Error(`Jupiter swap failed: ${result.error ?? "unknown error"}`);
    return { signature: result.signature, outputAtomic: BigInt(result.totalOutputAmount) };
  }
}
