import { z } from "zod";

const environment = z.object({
  PILEUP_MODE: z.enum(["demo", "live"]).default("demo"),
  PILEUP_TREASURY_ENABLED: z.enum(["true", "false"]).default("false"),
  PILEUP_DEMO_GLOBAL_CAP_USD: z.coerce.number().positive().default(500),
  PILEUP_DEMO_WALLET_CAP_USD: z.coerce.number().positive().default(50),
  PILEUP_ALLOWED_ORIGINS: z.string().default(""),
  PILEUP_USDC_MINT: z.string().default("USDC"),
  PILEUP_MINT_SPYX: z.string().default("CONFIGURE_SPYX_MINT"),
  PILEUP_MINT_NVDAX: z.string().default("CONFIGURE_NVDAX_MINT"),
  PILEUP_MINT_AAPLX: z.string().default("CONFIGURE_AAPLX_MINT"),
  PILEUP_STRIPE_PRODUCT_ID: z.string().default("prod_CONFIGURE_WEEKLY_PILE"),
  PILEUP_STRIPE_PORTAL_CONFIGURATION_ID: z.string().optional(),
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
export const allowedOrigins = config.PILEUP_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);

export const basketRegistry = [
  { symbol: "SPYx", mint: config.PILEUP_MINT_SPYX, bps: 4000 },
  { symbol: "NVDAx", mint: config.PILEUP_MINT_NVDAX, bps: 3000 },
  { symbol: "AAPLx", mint: config.PILEUP_MINT_AAPLX, bps: 3000 }
] as const;

export function assertLiveConfiguration(): void {
  if (config.PILEUP_MODE !== "live") return;
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
  const configuredValues = [...basketRegistry.map((asset) => asset.mint), config.PILEUP_STRIPE_PRODUCT_ID, config.PILEUP_USDC_MINT];
  if (configuredValues.some((value) => value.includes("CONFIGURE_"))) throw new Error("Live mode cannot use placeholder mints or Stripe prices");
}
