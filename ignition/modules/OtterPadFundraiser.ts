/**
 * 
 * 
# Using mock tokens (default)
npx hardhat ignition deploy ./ignition/modules/OtterPadFundraiser.ts
npx hardhat ignition deploy ./ignition/modules/OtterPadFundraiser.ts --network sepolia

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

const DEFAULT_START_PRICE = parseEther("1"); // 1 PAY
const DEFAULT_END_PRICE = parseEther("4"); // 4 PAY
const DEFAULT_TARGET = parseEther("100000"); // 100,000 PAY
const DEFAULT_UPFRONT_RAKE_BPS = 1000n; // 10%
const DEFAULT_ESCROW_RAKE_BPS = 1000n; // 10%

const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Mainnet V2 Router
const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"; // Mainnet V2 Factory

export default buildModule("OtterPadFundraiserModule", (m) => {
  // Get parameters with defaults
  const useMockTokens = m.getParameter("useMockTokens", true);
  const saleTokenAddress = m.getParameter<string>(
    "saleToken",
    "0xea0D03c0aBc36a1Ca7864e03f2E40333D6F4D0F4"
  );
  const paymentTokenAddress = m.getParameter<string>(
    "paymentToken",
    "0xBc255963Da9C9bdeD90774c821B3FAC81Bf487C1"
  );
  const foundersWallet = m.getParameter<string>(
    "foundersWallet",
    "0x99efDe4Ed41D5d1318dEa9574679275c21e6895D"
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
  // const mockSaleToken = m.contract("MockERC20", ["Sale Token", "SALE"], {
  //   id: "SaleToken",
  // });
  // const mockPaymentToken = m.contract("MockERC20", ["Payment Token", "PAY"], {
  //   id: "PaymentToken",
  // });

  // Deploy the fundraiser
  const fundraiser = m.contract("OtterPadFundraiser", [
    "Crypto Project", // title
    "https://api.legions.bot/api/w/officex/capture_u/f/officex/otterpad_rest_api", // richInfoUrl
    saleTokenAddress, // useMockTokens ? mockSaleToken : saleTokenAddress,
    paymentTokenAddress, // useMockTokens ? mockPaymentToken : paymentTokenAddress,
    UNISWAP_ROUTER,
    UNISWAP_FACTORY,
    startPrice,
    endPrice,
    targetLiquidity,
    upfrontRakeBPS,
    escrowRakeBPS,
    foundersWallet,
  ]);

  // If using mock tokens, mint initial supply
  // if (useMockTokens) {
  //   const mintAmount = parseEther("1000000"); // 1M tokens
  //   m.call(mockSaleToken, "mint", [fundraiser, mintAmount]);
  //   m.call(mockPaymentToken, "mint", [foundersWallet, mintAmount]);
  // }

  // Only return the contracts that were actually used
  return { fundraiser };
});
