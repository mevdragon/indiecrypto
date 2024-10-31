/**
 * 
 * 
# Using mock tokens (default)
npx hardhat ignition deploy ./ignition/modules/OtterPadFundraiser.ts

# Using existing tokens
npx hardhat ignition deploy ./ignition/modules/OtterPadFundraiser.ts --parameters '{
  "useMockTokens": false,
  "saleToken": "0x...",
  "paymentToken": "0x...",
  "foundersWallet": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}'
  
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const DEFAULT_START_PRICE = parseEther("0.001"); // 0.001 ETH
const DEFAULT_END_PRICE = parseEther("0.002"); // 0.002 ETH
const DEFAULT_TARGET = parseEther("100"); // 100 ETH
const DEFAULT_UPFRONT_RAKE_BPS = 200n; // 2%
const DEFAULT_ESCROW_RAKE_BPS = 300n; // 3%

export default buildModule("OtterPadFundraiserModule", (m) => {
  // Get parameters with defaults
  const useMockTokens = m.getParameter("useMockTokens", true);
  const saleTokenAddress = m.getParameter<string>("saleToken");
  const paymentTokenAddress = m.getParameter<string>("paymentToken");
  const foundersWallet = m.getParameter<string>(
    "foundersWallet",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  );

  const startPrice = m.getParameter("startPrice", DEFAULT_START_PRICE);
  const endPrice = m.getParameter("endPrice", DEFAULT_END_PRICE);
  const targetLiquidity = m.getParameter("targetLiquidity", DEFAULT_TARGET);
  const upfrontRakeBPS = m.getParameter(
    "upfrontRakeBPS",
    DEFAULT_UPFRONT_RAKE_BPS
  );
  const escrowRakeBPS = m.getParameter(
    "escrowRakeBPS",
    DEFAULT_ESCROW_RAKE_BPS
  );

  // Always deploy mock tokens but only use them if useMockTokens is true
  const mockSaleToken = m.contract("MockERC20", ["Sale Token", "SALE"], {
    id: "SaleToken",
  });
  const mockPaymentToken = m.contract("MockERC20", ["Payment Token", "PAY"], {
    id: "PaymentToken",
  });

  // Deploy the fundraiser
  const fundraiser = m.contract("OtterPadFundraiser", [
    useMockTokens ? mockSaleToken : saleTokenAddress,
    useMockTokens ? mockPaymentToken : paymentTokenAddress,
    startPrice,
    endPrice,
    targetLiquidity,
    upfrontRakeBPS,
    escrowRakeBPS,
    foundersWallet,
  ]);

  // If using mock tokens, mint initial supply
  if (useMockTokens) {
    const mintAmount = parseEther("1000000"); // 1M tokens
    m.call(mockSaleToken, "mint", [fundraiser, mintAmount]);
    m.call(mockPaymentToken, "mint", [foundersWallet, mintAmount]);
  }

  // Only return the contracts that were actually used
  return { fundraiser };
});
