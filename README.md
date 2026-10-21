# CashMine payback (practical task)

**Live:** LIVE_URL

## Run locally

```sh
npm install
npm run web      # opens http://localhost:8081
npm test         # amount logic unit tests (Node test runner)
npx expo export -p web   # static build in dist/
```

On first open the app asks for your API token. It is stored only in your browser, and you can change it with "Change token".

## What works

- **Balances:** each asset's available, pending and claiming amounts, the USD total, and how fresh the data is ("Updated Ns ago"). Shows loading and error/retry states, and refreshes automatically every 15 s or with the Refresh button.
- **Claim:** pick an asset, enter an amount or tap Max, and choose a destination. The amount is validated live against the API rules, and the fee and "you receive" amounts are shown. A confirm step follows, then a status screen that tracks the claim until it completes or fails. Timeouts are retried safely with the same Idempotency-Key.
- **Tests:** parsing, formatting, validation, fee, USD totals, and the balance overlay (`src/amount.test.ts`).
- **Activity:** paginated history of accruals, reversals and claims.

Decisions and known issues are in [NOTES.md](NOTES.md).
