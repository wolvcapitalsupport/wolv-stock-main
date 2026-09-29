# Day 3: Fixing the Wallet Architecture -

Today was all about making the wallet connection flow robust and user-friendly. The goal was simple on paper: support both injected wallets (MetaMask, Trust Wallet) and WalletConnect for mobile, show a helpful UI when no wallet is connected, and never expose sensitive keys in the code. As with most things, the devil was in the details.

## The Starting Point
I began with a wallet service (`lib/wallet.ts`) that only checked `window.ethereum` – a fine approach for desktop but useless on mobile Chrome where users expect to scan a QR code with their Trust Wallet or similar. The UI (`WalletSelector`) was already built, but the connection logic needed a complete overhaul to support multiple providers gracefully.

## Struggle #1: TypeScript Hell

First up, TypeScript refused to cooperate. the `connectWallet` function returned an `ethers.BrowserProvider | null`, but the UI's `useWallet` hook expected its `connect` method to return `Promise<void>`. Why? Because the UI doesn't actually use the returned provider – it manages connection state internally.

**The Fix:** I changed `useWallet.ts`'s `connect` function to set state (`provider`, `address`) directly and return `void`. Simple in retrospect, but it took a few attempts to get the auto-reconnect effect to play nice without expecting a return value.

Then came the WalletConnect import. i initially reached for `@walletconnect/web3wallet`, only to discover it didn't export a `WalletConnectConnector` – the thing we were trying to instantiate. After some head-scratching, i switched to `@walletconnect/ethereum-provider`, which is designed to work seamlessly with ethers.js.

## Struggle #2: The WalletConnect Init Trap

Here's where I kicked myself: assuming the WalletConnect provider behaved like a normal constructor.

```javascript
// What I tried first (wrong)
const walletConnectProvider = new WalletConnectProvider({
  chainId: 56,
  rpcUrl: "...",
  qrcode: true
});
```

Turns out, the `WalletConnectProvider` class from `@walletconnect/ethereum-provider` has a private constructor. The proper way to initialize it is via the static `init()` method, which takes an options object including your WalletConnect project ID, chains, and RPC map.

**The Fix:** i replaced the `new WalletConnectProvider(...)` with:
```javascript
const walletConnectProvider = await WalletConnectProvider.init({
  projectId: process.env.NEXT_PUBLIC_WALLET_PROJECT_ID,
  chains: [56],
  optionalChains: [],
  rpcMap: { 56: "https://bsc-dataseed.binance.org/" },
  showQrModal: true,
  metadata: { /* ... */ }
});
```

But wait – TypeScript started complaining that `projectId` might be `string | undefined`. Ah, right: environment variables can be undefined if not set. i couldn't just hardcode a project ID (security risk!), so i added a guard clause:
```javascript
if (!process.env.NEXT_PUBLIC_WALLET_PROJECT_ID) {
  console.error('WalletConnect project ID is not configured. Set NEXT_PUBLIC_WALLET_PROJECT_ID environment variable.');
  return null;
}
```
This way,  fail gracefully with a clear message instead of letting the app crash with a cryptic error later.

## Struggle #3: The Server/Client Divide

Next.js App Router defaults to server components, but the `useWallet` hook relies on browser-only APIs like `window.localStorage` and `window.ethereum`. I've d already marked the hook with `"use client"`, but forgot to do the same for `app/wallet/page.tsx`.

The error was unmistakable:
> "Attempted to call useWallet() from the server but useWallet is on the client."

**The Fix:** Adding `"use client";` at the very top of `app/wallet/page.tsx` – **before any imports**. This is crucial; if you put it after exports or imports, Next.js ignores it. Lesson learned: `"use client";` must be the first line in the file.

## Struggle #4: Dead-End 404 Pages

When a user navigated to `/trade/0xinvalidaddress`, they'd hit a `notFound()` call and see Next.js's default 404 page. Not helpful, especially since the average user doesn't know what a "contract address" is.

**The Fix:** I replaced the `notFound()` in `app/trade/[address]/page.tsx` with a user-friendly message:
```jsx
if (!token) {
  return (
    <main className="min-h-screen bg-[#07070f] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-[#64748b]">
          Asset not found. Please check the asset address or return to the trade page to select an asset.
        </p>
        <Link href="/trade" className="text-[#f0b90b] text-sm mt-4 block">
          ← Back to Trade Page
        </Link>
      </div>
    </main>
  );
}
```
Now users get clear guidance instead of a confusing error page.

## The Home Stretch

After wrestling with these issues, I ran the build one last time. The sweet sound of "Build completed (exit code 0)" meant:
- TypeScript was happy
- The WalletConnect initialization worked
- The wallet page rendered correctly as a client component
- No more server/client mismatches
- Environment variables were handled safely

## Key Takeaways

1. **Read the Docs (Seriously):** The `@walletconnect/ethereum-provider` exports a class that must be initialized via `init()`, not a constructor. A five-minute skim of the types file would have saved an hour of frustration.
2. **"use client"; Placement Matters:** In Next.js, this directive must be the very first line in the file – no imports, no comments, nothing above it.
3. **Environment Variables Aren't Optional:** Always validate required env vars early and fail gracefully. Silent failures are worse than loud, clear errors.
4. **User-Friendly Errors Beat 404s:** When possible, replace cryptic errors with actionable guidance. Users shouldn't need to understand internals to navigate your app.
5. **State Management is Tricky:** When refactoring connection logic, remember that the UI often manages its own state – the service layer doesn't need to return everything.

The wallet flow now works as intended:
- Home → Asset Page → "Trade This Asset" → Wallet Connect UI → Trade UI
- Home → Trade Page → Search Asset → Trade UI → Wallet Connect UI → Trade UI

And critically, no keys live in the codebase – the WalletConnect project ID comes strictly from environment variables.

Time to commit and move on to the next challenge.
