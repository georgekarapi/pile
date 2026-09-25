# Pile

> ✅ Codebase is Devnet ready

![Pile banner](demo/pile-banner.jpg)

> Pile up your stocks every week, let them work as collateral and swipe your card like nothing happened. 🤙

Users set a weekly dollar amount, pay via card, and Pile automatically swaps into a curated pre-IPO token basket, deposits collateral into a lending protocol, and borrows back USDC to a debit card.

---

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo (iOS & Android) |
| Routing | Expo Router |
| Styling | NativeWind / Tailwind |
| State | Zustand + TanStack Query |
| Backend | Firebase Cloud Functions (Node 24, Express) |
| Database | Firestore |

---

## Providers

| Provider | Role |
|---|---|
| [Privy](https://privy.io) | Auth + embedded Solana wallet (users never touch private keys) |
| [Stripe](https://stripe.com) | Weekly subscription billing & webhooks |
| [Kamino](https://kamino.finance) | Solana lending — collateral deposits & USDC borrows |
| [Jupiter](https://jup.ag) | DEX aggregator — swaps USDC into token baskets |
| [Bridge](https://bridge.xyz) | KYC identity verification + debit card |
| [PreStocks](https://prestocks.com) | Live pre-IPO token prices & metadata |

---

## How it works

```
1. User pays weekly via Stripe
2. invoice.paid webhook triggers a funding cycle
3. USDC is credited to the user's Privy wallet
4. USDC is swapped into the chosen token basket (Jupiter)
5. Tokens are deposited as collateral (Kamino)
6. USDC is borrowed against collateral (Kamino)
7. Borrowed USDC is available on a Bridge debit card
```

Every step is persisted to Firestore and resumes from the last confirmed state on failure. All transactions are built server-side, policy-validated, and signed by Privy before hitting the chain.

---

## Local development

```bash
pnpm install
pnpm dev              # Expo Go (demo mode, no auth/payments)

# For full auth + Stripe:
pnpm --filter @pile/mobile run start:dev-client
```

Copy `.env.example` to `.env` and fill in your keys.
