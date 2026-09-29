# WOLV Stock Terminal — Developer Experience Log

## Day 1 — Sept 23, 2026

### Authentication (60 mins to figure out)
- Initially used wrong base URL: `api.binance.com` → got 400 Invalid API Key
- The `BX-` key prefix is Web3 portal only, not exchange API
- Signature uses Base64(HMAC-SHA256) not hex — this is different from standard Binance exchange API
- The `/build` prefix in requestPath is critical — missing it causes 40102 Invalid signature
- Documentation says this clearly but it's easy to miss on first read

### Token List Fields
- Field names not obvious: `underlyingTicker` not `ticker`, `tokenLogoUrl` not `logoUrl`
- No TypeScript types provided — had to console.log first token to discover structure
- `referencePrice` vs `tokenPrice` — gap data already embedded in token list (good design)

### proot-distro Issue
- Next.js 16 Turbopack crashes on proot Ubuntu — symlink resolution fails
- Fix: `next dev --webpack` flag required
- Not documented anywhere — wasted ~2 hours diagnosing
