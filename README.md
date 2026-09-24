# Pileup

Keep the pile. Spend the overflow.

## Workspaces

- `apps/mobile` — Expo mobile client using React Native Reusables-compatible UI primitives.
- `functions` — Firebase Functions v2 HTTP API, signed webhooks, provider factory, and scheduled health refreshes.
- `packages/shared` — provider-neutral domain types, validation, and risk math.

## Operating modes

`PILEUP_MODE=demo` is the only safe default. It uses deterministic transaction adapters and requires `PILEUP_TREASURY_ENABLED=true` before a demo credit can proceed.

`PILEUP_MODE=live` rejects unsigned Stripe webhooks and unverified mobile requests. Before enabling it, configure real mint addresses, Kamino market, Privy verification credentials, Bridge program values, Stripe prices, a hardware-secured treasury, and provider approvals.

## Local setup

1. Copy `functions/.env.example` to `functions/.env` and fill provider credentials.
2. Install and select the repo's Node version with `nvm install` and `nvm use` (`.nvmrc` pins Node 24).
3. Enable Corepack's pnpm shim for that nvm-managed Node installation with `corepack enable pnpm`.
4. Run `pnpm install` (the root `packageManager` field pins pnpm 12.4.2).
5. Run `pnpm test` and `pnpm typecheck`.
6. Start emulators with `pnpm dlx firebase-tools emulators:start` after configuring a Firebase project.
7. Copy `apps/mobile/.env.example` to `apps/mobile/.env`, then start the development client with `pnpm --filter @pileup/mobile start`.
8. Verify the production iOS JavaScript bundle with `pnpm --filter @pileup/mobile export:ios`.

All money-moving adapters default to explicit demo mode. Never add treasury keys or provider secrets to the mobile app.

The mobile workspace includes the Expo/Privy peer dependencies, NativeWind Metro
configuration, and Hermes transform profile required by the current Expo SDK.

## Safety invariants

- A Stripe invoice is not a wallet credit. Credit, swap, deposit, borrow, and card readiness are individually persisted workflow states.
- Stripe webhooks validate immutable subscription identity and enqueue work; a task worker submits and confirms each on-chain lending action.
- Firestore is never an account ledger; Solana and Kamino are the balance/risk source of truth.
- The delegated signer may use only configured programs and mints, within the cycle cap, and may borrow only to the user wallet.
- The card spends existing USDC. Pileup does not borrow in the card authorization path and never auto-sells xStocks.
- Jupiter uses Swap V2's short-lived `/order` → sign → `/execute` flow; every assembled transaction is policy-checked before it reaches a signer.

See [FLOW_RULES.md](FLOW_RULES.md) for the product-flow rules enforced by the
mobile app, Firebase workflows, and provider adapters.
