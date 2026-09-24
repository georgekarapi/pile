# Pileup flow rules

These rules are product invariants. A UI convenience, adapter change, or demo
shortcut must not bypass them.

1. Stripe Billing records a subscription payment; it does not directly credit a customer wallet. In demo mode, only an explicitly enabled, capped treasury credit may follow a verified `invoice.paid` event. In live mode, a licensed on-ramp or treasury workflow must be configured before any on-chain action.
2. Only a verified, validated, deduplicated webhook may create a funding cycle. Stripe subscription metadata, subscription ID, live mode, collection method, currency, and exact amount must match the stored plan. A client cannot call a “buy” endpoint with an arbitrary fiat amount.
3. The webhook persists an inbox event and queues the cycle; it never performs the on-chain workflow in the HTTP request. Each cycle progresses in order: credit → swap → deposit → borrow. Persist submitted signatures, confirm every chain transaction, and resume from the last durable state; never retry an earlier movement just because a later movement failed.
4. Every client mutation includes an `Idempotency-Key`. Stripe receives the same key for customer/subscription creation; protocol and card adapters must use provider idempotency facilities where available.
5. All Solana transactions are built by a server-side adapter and signed by the user’s scoped Privy signer. Before signing, validate owner, permitted program IDs, token mints, maximum input, and every recipient. A live adapter must decode the serialized transaction (including address lookup tables) rather than trusting adapter-declared intent. Borrow proceeds may only go to the owner’s USDC account.
6. The app never stores seed phrases, private keys, PANs, CVCs, PaymentMethods, or a balance ledger. Chain/protocol state is authoritative; Firestore stores preferences, provider identifiers, workflow checkpoints, and cached health.
7. Borrowing is only the conservative `additionalBorrowUsd` returned by the health calculation. Card availability is existing funding USDC after reserve, never theoretical remaining borrowing capacity.
8. Do not automatically sell collateral or borrow during card authorization. Repay/deleverage requires an explicit user action. Pause new purchases at the warning threshold; freeze external card spending at the critical threshold.
9. Demo mode is visibly labelled and fail-closed by default. The faucet requires both an environment opt-in and per-wallet/global caps. Live mode must refuse to start with placeholders or missing provider credentials.
10. RNR screens remain presentation-only. Protocol calls live in use-cases and ports; UI states are derived from the API health snapshot rather than duplicated financial math.
11. Native app calls may omit `Origin`; browser calls must match the explicit Functions allow-list. Do not reflect arbitrary origins or ship secrets in `EXPO_PUBLIC_*` variables.
