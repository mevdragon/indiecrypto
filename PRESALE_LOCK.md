# PreSaleLock.sol

How PresaleLock works chronologically

## 1. Initial Setup & Early Fundraising

Founders create PresaleLock contract (no OtterPad fund needed yet)
Early investors can send ERC20 tokens directly to the contract
Contract tracks all token transfers as fundraising history

## 2. Token Collection

Founders can collect received ERC20 tokens (except SALE token) via collectTokensAsFounders
OtterPad DAO receives 2% fee, founders get remaining 98%

## 3. OtterPad Integration

Founders deploy OtterPad fund contract with SALE token
Connect PresaleLock to fund via setFundraiser
This enables SALE token deposits

## 4. SALE Token Distribution

Founders manually deposit SALE tokens for each investor
Each deposit includes:

- Recipient address
- Token amount
- Unlock timestamp (can be zero)
- Transaction hash (to track/prevent duplicates, can be zero address)

## 5. Token Redemption

Requirements to redeem:

- OtterPad fund must be deployed to DEX
- Unlock time passed (if set)
- Deposit not already redeemed

Anyone can trigger redemption for a recipient
Contract continues accepting deposits/redemptions after DEX deployment
