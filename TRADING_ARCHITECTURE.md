# WOLV Stock Terminal - RWA Trading Architecture Report

## 1. Exact Binance Endpoints Required for RWA Trading

Based on analysis of existing code patterns and Binance Web3 API documentation references:

### Core Trading Endpoints:
- **POST** `/api/v1/dex/aggregator/quote` (EXISTS) - Currently used for read-only quotes
  - *Will remain for read-only functionality with dead wallet address*
- **POST** `/api/v1/dex/aggregator/execute` (REQUIRED NEW) 
  - For standard aggregator swap execution
  - Parameters: `quoteId`, `userWalletAddress`, `slippageTolerance`, `referralCode` (optional)
  - Returns: `transactionHash`, `status`

### RFQ Flow Endpoints (More likely for RWA per user guidance):
- **POST** `/api/v1/dex/rfq/quote` (REQUIRED NEW)
  - Parameters: 
    - `binanceChainId`: "56"
    - `fromTokenAddress`: USDT (`0x55d398326f99059fF775485246999027B3197955`)
    - `toTokenAddress`: [RWA token contract]
    - `amount`: [USDT amount in wei]
    - `userWalletAddress`: [connected wallet]
  - Response: Array of signed quotes with `quoteId`, `makerAddress`, `makerSignature`, `tokenAmount`, `expirationTimestamp`
  
- **POST** `/api/v1/dex/rfq/execute` (REQUIRED NEW)
  - Parameters:
    - `quoteId`: [selected from quote response]
    - `makerSignature`: [from quote response]
    - `userWalletAddress`: [connected wallet]
    - `userSignature`: [wallet signature of quoteId + nonce]
  - Returns: `transactionHash`, `gasUsed`, `status`

### Supporting Endpoints:
- **GET** `/api/v1/dex/account/portfolio` - User token holdings (Address Portfolio API)
- **GET** `/api/v1/dex/account/transaction-history` - User trade history
- **GET** `/api/v1/dex/allowance` - Check USDT allowance for Router contract

## 2. Exact RFQ Flow Required

For RWA assets (bStocks/Ondo) per user guidance:

### Step-by-Step RFQ Flow:
1. **Quote Request** (Server→Binance):
   - User selects token and amount in UI
   - Client requests RFQ from server endpoint (to protect API keys)
   - Server signs request with API keys and calls `/api/v1/dex/rfq/quote`
   - Returns multiple maker-signed quotes to client

2. **Quote Display** (Browser):
   - Client shows quotes from different makers with expiration times
   - User selects preferred quote

3. **User Signature** (Browser - Critical):
   - Client creates message: `keccak256(abi.encodePacked(quoteId, userWalletAddress, nonce))`
   - User signs message with wallet private key (client-side only)
   - **Never** exposes private key to server

4. **Execution Submission** (Client→Server→Binance):
   - Client sends `{quoteId, userSignature, userWalletAddress}` to server
   - Server verifies user signature (ECDSA recovery)
   - If valid, server calls `/api/v1/dex/rfq/execute` with:
     - `quoteId`
     - `makerSignature` (from quote response)
     - `userWalletAddress` 
     - `userSignature` (from step 3)
   - Returns transaction hash to client

5. **Transaction Confirmation** (Optional):
   - Poll `/api/v1/dex/account/transaction-history` or use websocket
   - Show confirmation when transaction is mined

## 3. What Must Happen in the Browser

### Client-Only Operations:
- **Wallet Connection**: 
  - Connect to MetaMask/WalletConnect via `window.ethereum`
  - Retrieve user's wallet address (`eth_requestAccounts`)
  - Listen for account/chain changes
  
- **Transaction Signing**:
  - Sign RFQ-specific messages (quoteId + wallet + nonce) using `personal_sign` or `eth_signTypedData`
  - **Never** send private keys or seed phrases to server
  
- **UI Interactions**:
  - Wallet connect/disconnect buttons
  - Trade input forms (amount selection)
  - Quote selection interface
  - Transaction status display
  
- **Message Construction**:
  - Build deterministic messages for signing (using ethers.js viem)
  - Handle nonce generation to prevent replay attacks

### Critical Security Boundary:
- **Private keys NEVER leave browser**
- **All signing happens client-side**
- **Server only verifies signatures, never creates them**

## 4. What Must Remain Server-Side

### Server-Only Operations (Protects API Keys):
- **API Authentication**:
  - All Binance API calls requiring `X-OC-APIKEY` and `X-OC-SIGN`
  - HMAC-SHA256 signing with `BINANCE_SECRET_KEY`
  
- **RFQ Request Handling**:
  - Server makes `/api/v1/dex/rfq/quote` call (hides API keys)
  - Server makes `/api/v1/dex/rfq/execute` call (after validation)
  
- **Signature Verification**:
  - Verify maker signatures from quote responses
  - Verify user signatures (using recovered public key)
  
- **Rate Limiting & Caching**:
  - Maintain existing 5 req/s rate limiting
  - Manage quote caching (30s TTL as in existing code)
  
- **Error Handling**:
  - Map Binance API errors to user-friendly messages
  - Handle network failures, rate limit errors (42900)

### Protected Data:
- `BINANCE_API_KEY` and `BINANCE_SECRET_KEY` (in `.env.local`)
- All HMAC signing logic for Binance API requests
- Server-to-Binance communication channels

## 5. Existing Files That Should Be Modified

### Modifications Required:
- **`app/page.tsx`**:
  - Add wallet connect button in navigation bar
  - Show wallet address when connected
  
- **`app/stock/[address]/page.tsx`**:
  - Add trade execution section below price/gap display
  - Input for USDT amount (or token amount)
  - "Get Quote" and "Execute Trade" buttons
  - Transaction status display
  
- **`app/gap/page.tsx`**:
  - Add "Trade" button/link to each venue card
  - Navigate to stock page with pre-filled trade intent
  
- **`components/StockList.tsx`**:
  - Optional: Add quick trade buttons (requires token context)
  - May need to pass down trade callbacks
  
- **`lib/binance.ts`**:
  - Add new functions for RFQ endpoints:
    - `getRfaQuote(tokenAddress, amount, walletAddress)` → POST `/api/v1/dex/rfq/quote`
    - `executeRfaQuote(quoteId, makerSignature, walletAddress, userSignature)` → POST `/api/v1/dex/rfq/execute`
  - Reuse existing `makeHeaders()` and `rateLimit()` logic
  
- **`lib/quotes.ts`**:
  - **NO CHANGES NEEDED** - Preserve existing read-only quote functionality
  - Existing `quoteUsd()` continues to work with dead wallet for read-only quotes
  - New trading uses separate RFQ/execute endpoints

## 6. New Files That Should Be Created

### Essential New Files:
- **`lib/wallet.ts`**:
  - Wallet connection utilities (using ethers.js)
  - Functions: `connectWallet()`, `disconnectWallet()`, `getAddress()`, `signMessage(message)`
  - Chain ID enforcement (require BSC Mainnet: 56)
  
- **`hooks/useWallet.ts`**:
  - React hook for wallet state management
  - Returns: `{ address, isConnected, connect, disconnect, error }`
  - Handles reconnecting, chain change events, network mismatches
  
- **`components/WalletConnectButton.tsx`**:
  - UI component for wallet connection
  - Shows connect/disconnect status
  - Handles wallet selection modal (MetaMask, WalletConnect, etc.)
  
- **`components/TradeForm.tsx`**:
  - Reusable trade form component
  - Inputs: USDT amount, slippage tolerance
  - Buttons: Get RFQ, Execute Trade
  - Loading states and error handling
  
- **`components/TransactionStatus.tsx`**:
  - Displays transaction status (pending/confirmed/failed)
  - Shows transaction hash with link to BSCScan
  - Optionally displays gas used and confirmation time

## 7. Necessary NPM Dependencies

### Actually Required (Minimal Set):
- **`ethers`** (^6.7.0):
  - Wallet connection and signing
  - Message signing (`signMessage`)
  - Address and transaction utilities
  - **Critical**: Used ONLY for client-side signing, never for API calls
  
- **`@web3modal/ethers`** (^2.6.2) or **`@wagmi/core`** (^1.4.5) + **`@wagmi/connectors`**:
  - Simplified wallet connection (MetaMask, WalletConnect, etc.)
  - Alternative: minimal custom implementation using just `ethers`

### Dependencies NOT Needed:
- **`web3`** - Overkill, `ethers` suffices
- **`@binance/web3-sdk`** - Doesn't appear to exist; use direct API calls
- **Additional charting libraries** - Existing `lightweight-charts` sufficient if needed later
- **State management libraries** (Redux, Zustand) - React hooks sufficient for this scope

### Installation Impact:
- Adds ~200-300KB minified bundle size (ethers + web3modal)
- Zero server-side dependency changes (API keys remain server-only)

## 8. Blockers and API Limitations

### Potential Blockers:
1. **RFQ Endpoint Availability**:
   - Must confirm `/api/v1/dex/rfq/quote` and `/api/v1/dex/rfq/execute` exist
   - If not available, fallback to standard aggregator `/api/v1/dex/aggregator/execute` flow
   - Standard flow requires different signing (approve + swap vs RFQ signature)

2. **Wallet Connection UX**:
   - Users unfamiliar with wallet connection may need clear guidance
   - Must handle network mismatches (require BSC Mainnet)
   - Mobile wallet connection (WalletConnect) adds complexity

3. **Transaction Failure Handling**:
   - On-chain reverts (insufficient allowance, slippage, etc.)
   - Need to decode revert reasons for user-friendly messages
   - Gas estimation failures

4. **API Rate Limits**:
   - Trading increases API calls (quote + execute per trade)
   - Must maintain existing 5 req/s limit with queuing if needed
   - Read-only quotes should remain unaffected

5. **Token Approvals**:
   - For standard swaps: USDT allowance to Router contract needed
   - For RFQ: May require different approval flow (verify with API)
   - Should check/handle allowance automatically

### API Limitations to Verify:
- Minimum/maximum trade sizes for RFQ
- Supported token pairs (USDT→RWA only? or also RWA→USDT?)
- Quote expiration times (typically 30-60 seconds)
- Maker fee structure and distribution
- Geographic/restriction checks (KYC/AML)

## 9. Implementation Plan (4 Safe Steps)

### Phase 1: Wallet Connection & Read-Only Preservation (Safe)
- **Goal**: Add wallet connection without changing trading functionality
- **Changes**:
  - Create `lib/wallet.ts` and `hooks/useWallet.ts`
  - Add `WalletConnectButton` to nav in `app/page.tsx`
  - Verify existing read-only quotes still work (dead wallet address)
- **Safety**: 
  - Zero changes to API call logic
  - Wallet connection is additive UI only
  - Can be rolled back by removing components
- **Verification**: 
  - Wallet connects/shows address
  - Existing stock/gap pages unchanged
  - No effect on API keys or signing

### Phase 2: RFQ Infrastructure (Read-Only Backend)
- **Goal**: Implement RFQ quote request (server-side only)
- **Changes**:
  - Add `getRfaQuote()` to `lib/binance.ts`
  - Create server API route `/api/rfq-quote` (Next.js route handler)
  - Route handler calls Binance `/api/v1/dex/rfq/quote` with server keys
  - Returns quotes to client (no wallet yet)
- **Safety**:
  - No client-side signing yet
  - Uses existing rate limiting/caching
  - Read-only quote flow untouched
  - Can test with hardcoded wallet address
- **Verification**:
  - RFQ quotes display in console/UI
  - Proper error handling for invalid tokens
  - Rate limiting still functional

### Phase 3: Client-Side Signing & Execution (Core Trading)
- **Goal**: Enable actual trade execution with wallet signing
- **Changes**:
  - Add signature creation in `lib/wallet.ts` (`signMessage`)
  - Modify `app/stock/[address]/page.tsx` to include:
    - Trade form (USDT amount input)
    - "Get RFQ" button (calls server route)
    - Quote selection UI
    - "Execute Trade" button (triggers user signature)
    - Transaction status display
  - Create server route `/api/rfq-execute` to validate signatures and call Binance
- **Safety**:
  - Existing read-only paths completely separate
  - New endpoints only callable when wallet connected
  - Signature verification prevents unauthorized executions
  - Can test with small amounts first
- **Verification**:
  - Successful testnet trades (if available)
  - Proper error messages for failed txs
  - Transaction hash displayed and verifiable on BSCScan

### Phase 4: UX Polish & Portfolio (Enhancement)
- **Goal**: Add polish and optional features
- **Changes**:
  - Create `components/TransactionStatus.tsx`
  - Add portfolio display (`/api/v1/dex/account/portfolio`)
  - Improve quote selection UI (sort by amount/expiration)
  - Add slippage tolerance input
  - Add transaction history link
- **Safety**:
  - Purely additive features
  - No changes to core trading logic
  - Can be implemented incrementally
- **Verification**:
  - Portfolio shows correct holdings after trades
  - Transaction status updates correctly
  - UI responsive on mobile/desktop

### Key Safety Principles Throughout:
1. **Preserve Existing Functionality**: 
   - Read-only quote flow (`lib/quotes.ts` + dead wallet) 100% unchanged
   - All existing API calls and rate limiting intact
   - No modifications to `getRWATokenList`, `getRWAPrice`, etc.

2. **Security Boundaries**:
   - API keys never leave server
   - Private keys never leave browser
   - All signing clearly separated (server vs client)

3. **Incremental Rollout**:
   - Each phase independently testable
   - Clear rollback path for each phase
   - Minimal risk to existing user experience

4. **Maintain Performance**:
   - Reuse existing rate limiting (5 req/s)
   - Reuse existing caching strategies (30s quote TTL)
   - No additional server-side computational load

This approach delivers wallet-connected RWA trading while preserving all existing functionality and maintaining strict security boundaries between server and client operations.