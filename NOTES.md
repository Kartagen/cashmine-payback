# Notes

## Decisions

**Amounts: decimal strings → BigInt base units.** Every amount from the API is parsed into `amount × 10^decimals` as a `BigInt` (`src/amount.ts`), all math (min/max/fee/receive/overlay) happens on integers, and we format back to a string only for display and the POST body. ETH has 18 decimals (`12.345678901234591676`). A JS `number` can't hold that, and `0.1 + 0.2` errors would show up in "you receive". *Alternatives:* a decimal library (`big.js`/`decimal.js`). That works too, but BigInt is built in, and the parsing rules are short enough to own and test. USD values are `amount × price` in integers, rounded half-up to cents per asset and then summed. The total is display-only, so the rounding error stays under one cent per asset.

**Input validation** follows the docs exactly: `^(0|[1-9]\d*)(\.\d+)?$`, ≤ `decimals` places, `minAmount ≤ amount ≤ available`. I also accept a comma as the decimal separator for European mobile keyboards, and require amount > fee so "you receive" is never 0 or negative (an assumption, since the docs don't say). The server stays the final authority: `available` is checked live, and a 400 is shown to the user.

**Balance right after a claim: snapshot + reconciled overlay.** Options considered:
- (A) *Show only the server snapshot.* It's always "true", but snapshots are recomputed every 15 s, so the balance doesn't change after a claim. That's how user 1 ended up claiming twice.
- (B) *Optimistic subtract, overwritten by the next fetch.* The next fetch can be a snapshot older than the claim, so the money "comes back" and then leaves again. That's user 2's complaint.
- (C) **Chosen:** keep the claims this device submitted. For each one, if `claim.createdAt > snapshot.asOf` (both server timestamps), the snapshot doesn't include it yet, so we show `available − amount` and `claiming + amount`, labelled "incl. your new claim". Once a newer snapshot arrives, the overlay switches off by itself and nothing jumps. Failed claims are never overlaid, and when one fails the banner explicitly says "X is back in your available balance", so that jump is explained. Older responses (lower `asOf`) are ignored if they arrive out of order. On top of that, the Claim button for an asset is disabled while a claim for it is unresolved, which is a second guard against double claims. The overlay logic is a pure function with a unit test.

**Unknown claim outcome (timeout / 5xx / network).** Each claim gets an `Idempotency-Key` (UUID) once, at confirm time, stored in `localStorage` together with the exact body. Any unknown outcome (504, 500/503, network error, our 15 s client timeout) is retried with the same key and the same body, so the server can never create a second claim. The user sees "Checking your claim… it can never be claimed twice" and a "Check now" button, and the app keeps retrying in the background (every 3 s, honouring `Retry-After` on 429). This survives a page reload: a claim that was still sending when the page closed resumes as "unknown". If a later retry fails definitively (for example 401), we don't claim "nothing was claimed" and instead tell the user to check Activity. *Alternative:* show "failed, try again" and let the user resubmit with a new key. That's exactly how double claims happen, so no.

**Other decisions.**
- The total shows `available + pending` in USD (what you've earned and not yet claimed). `claiming` is shown per asset but excluded from the total.
- Freshness is "Updated Ns ago" from `asOf`. It turns orange after 60 s. Balances auto-refresh every 15 s, match the snapshot interval, and refresh immediately when a claim settles.
- GETs retry on 429/5xx/network errors with backoff. Non-retryable errors show a retry button, and a 401 tells the user to change the token.
- The token is stored in `localStorage`. "Change token" clears it, along with the claims tracked for the old token.
- Expo Router (`src/app/`). The first version switched four screens with state and had no router, which broke the browser back button and deep links. I moved to a real stack: routes are URLs (`/claim/BTC`, `/activity`), browser back works, and native builds get iOS large titles and Android Material back. Balances and claim tracking live in one provider (`src/store.tsx`), so they poll once no matter which route is open. The Vercel config rewrites every path to `index.html`.
- Design follows the rules in `CLAUDE.md`: calm and editorial, hairlines instead of cards, one accent (#D9480F) only on primary actions, Phosphor icons, and tabular numbers. All colors and type sizes live in `src/theme.ts`. Söhne is a paid font, so Inter is bundled as the stand-in and Söhne is used when it's installed.
- The tests use Node's built-in test runner (`npm test`), so there's no Jest config to maintain.

## Working with AI

All of this was built with Claude Code (`ai-logs/`).

1. **A prompt that didn't get what I wanted:** TODO (Illia: fill in from the log).
2. **AI output that was wrong or risky:**
   - The AI wrote a unit test expecting `820.413207 USDT × 1.0002 = $820.57`. The test failed, and doing the math by hand gives 820.5773 → $820.58, so the test was wrong and the code was right. Lesson: AI-written expected values have to be computed, not guessed.
   - The first version said "Nothing was claimed" for any definitive error. That's false when an earlier attempt for the same key timed out, because the claim may exist. This was caught when reviewing the unknown-outcome flow and fixed with an `uncertain` flag.
3. **Disagreed with / rejected a suggestion:** the `AGENTS.md` generated by `create-expo-app` tells the agent to always use Expo Router. I rejected that at first, for four screens. I reversed it during the design pass, once browser back and platform navigation conventions became requirements (see above). TODO (Illia: add your own if there's a better one).

**Security.** The brief requires keeping the token in the browser, so it goes in `localStorage`. Any script on the origin could read it, so the deployment sends a strict CSP (`connect-src` only the API, `script-src 'self'`, `frame-ancestors 'none'` against clickjacking of the confirm button; see `public/vercel.json`), and the app has no HTML or `eval` sinks. The token field is masked, and the token is cleaned of whitespace and zero-width characters, then checked to be printable ASCII. A malformed token used to show up as a "network error". `npm audit` reports 15 high and 7 moderate advisories, all in Expo's build-time CLI (`braces`, `node-forge`, `uuid`) and none in the shipped bundle. `audit fix --force` would break SDK 58, so I left them.

## Not done / known issues
- Activity doesn't link claims to their reversal or accrual (`relatedId`), and it doesn't auto-refresh after a new claim (reopen the screen).
- No pull-to-refresh gesture on web, only a Refresh button.
- A server `400 VALIDATION` on submit is shown on the status screen ("Claim not submitted… nothing was claimed"), not inline next to the field it names.
- While a claim's outcome is unknown, the balance isn't reduced, because there's no server claim to reconcile against. Instead, the Claim button for that asset is locked until the outcome is known.
- Claim history is kept only on this device. Another device won't see "unknown" claims from this one.
- No component or E2E tests. The flow was checked manually in headless Chrome at 390 px against the live API, including real 503/504 responses.
- Next: showing `failureReason` in Activity, and an E2E test with a mocked API for the timeout path.
