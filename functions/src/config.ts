import { z } from "zod";

const environment = z.object({
  PILE_MODE: z.enum(["demo", "live"]).default((process.env.PILEUP_MODE as "demo" | "live") ?? "demo"),
  PILE_TREASURY_ENABLED: z.enum(["true", "false"]).default((process.env.PILEUP_TREASURY_ENABLED as "true" | "false") ?? "false"),
  PILE_DEMO_GLOBAL_CAP_USD: z.coerce.number().positive().default(Number(process.env.PILEUP_DEMO_GLOBAL_CAP_USD) || 500),
  PILE_DEMO_WALLET_CAP_USD: z.coerce.number().positive().default(Number(process.env.PILEUP_DEMO_WALLET_CAP_USD) || 50),
  PILE_ALLOWED_ORIGINS: z.string().default(process.env.PILEUP_ALLOWED_ORIGINS ?? ""),
  PILE_USDC_MINT: z.string().default(process.env.PILEUP_USDC_MINT ?? "USDC"),
  PILE_MINT_SPYX: z.string().default(process.env.PILEUP_MINT_SPYX ?? "CONFIGURE_SPYX_MINT"),
  PILE_MINT_NVDAX: z.string().default(process.env.PILEUP_MINT_NVDAX ?? "CONFIGURE_NVDAX_MINT"),
  PILE_MINT_AAPLX: z.string().default(process.env.PILEUP_MINT_AAPLX ?? "CONFIGURE_AAPLX_MINT"),
  PILE_MINT_OPENAI: z.string().default(process.env.PILEUP_MINT_OPENAI ?? "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF"),
  PILE_MINT_SPACEX: z.string().default(process.env.PILEUP_MINT_SPACEX ?? "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh"),
  PILE_MINT_ANTHROPIC: z.string().default(process.env.PILEUP_MINT_ANTHROPIC ?? "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw"),
  PILE_MINT_ANDURIL: z.string().default(process.env.PILEUP_MINT_ANDURIL ?? "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB"),
  PILE_STRIPE_PRODUCT_ID: z.string().default(process.env.PILEUP_STRIPE_PRODUCT_ID ?? "prod_CONFIGURE_WEEKLY_PILE"),
  PILE_STRIPE_PORTAL_CONFIGURATION_ID: z.string().optional().default(process.env.PILEUP_STRIPE_PORTAL_CONFIGURATION_ID ?? ""),
  HELIUS_RPC_URL: z.string().url().optional(),
  JUPITER_API_KEY: z.string().optional(),
  KAMINO_MARKET_ADDRESS: z.string().optional(),
  BRIDGE_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  PRIVY_JWT_VERIFICATION_KEY: z.string().optional()
});

export const config = environment.parse(process.env);
export const allowedOrigins = config.PILE_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);

export const basketRegistry = [
  { symbol: "SPYx", mint: config.PILE_MINT_SPYX, bps: 4000 },
  { symbol: "NVDAx", mint: config.PILE_MINT_NVDAX, bps: 3000 },
  { symbol: "AAPLx", mint: config.PILE_MINT_AAPLX, bps: 3000 }
] as const;

export const prestocksRegistry = [
  { symbol: "OPENAI", mint: config.PILE_MINT_OPENAI, bps: 4000 },
  { symbol: "SPACEX", mint: config.PILE_MINT_SPACEX, bps: 3000 },
  { symbol: "ANTHROPIC", mint: config.PILE_MINT_ANTHROPIC, bps: 3000 }
] as const;

export const allConfiguredAssets = [...basketRegistry, ...prestocksRegistry] as const;

export function assertLiveConfiguration(): void {
  if (config.PILE_MODE !== "live") return;
  const required = [
    config.STRIPE_SECRET_KEY,
    config.STRIPE_WEBHOOK_SECRET,
    config.PRIVY_APP_ID,
    config.PRIVY_APP_SECRET,
    config.BRIDGE_API_KEY,
    config.HELIUS_RPC_URL,
    config.JUPITER_API_KEY,
    config.KAMINO_MARKET_ADDRESS
  ];
  if (required.some((value) => !value)) throw new Error("Live mode requires all provider credentials and chain configuration");
  const configuredValues = [...basketRegistry.map((asset) => asset.mint), config.PILE_STRIPE_PRODUCT_ID, config.PILE_USDC_MINT];
  if (configuredValues.some((value) => value.includes("CONFIGURE_"))) throw new Error("Live mode cannot use placeholder mints or Stripe prices");
}
