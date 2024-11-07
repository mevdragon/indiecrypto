/**
 * 
 * 
# Using mock tokens (default)
npx hardhat ignition deploy ./ignition/modules/OtterPadFund.deploy.ts
npx hardhat ignition deploy ./ignition/modules/OtterPadFund.deploy.ts --network sepolia  --verify

# Using existing tokens
npx hardhat ignition deploy ./ignition/modules/OtterPadFund.deploy.ts --parameters '{
  "useMockTokens": false,
  "saleToken": "0x...",
  "paymentToken": "0x...",
  "foundersWallet": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}'
  
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther, parseUnits, zeroAddress } from "viem";

const DEFAULT_START_PRICE = parseUnits("1", 6); // 1 PAY
const DEFAULT_END_PRICE = parseUnits("3", 6); // 3 PAY
const DEFAULT_TARGET = parseUnits("100", 6); // 100 PAY
const DEFAULT_UPFRONT_RAKE_BPS = 1000n; // 10%
const DEFAULT_ESCROW_RAKE_BPS = 1000n; // 10%

const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Mainnet V2 Router
const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"; // Mainnet V2 Factory

export default buildModule("OtterPadFundraiserModule", (m) => {
  // Get parameters with defaults
  const useMockTokens = m.getParameter("useMockTokens", true);
  const saleTokenAddress = m.getParameter<string>(
    "saleToken",
    "0x9eC6b6f455B45fe44d0Edff3d10F7e6219C1202e"
  );
  const paymentTokenAddress = m.getParameter<string>(
    "paymentToken",
    "0x9AcF3D5E879Affd4a718dF1526a44f0303854d98"
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
  const fundraiser = m.contract("OtterPadFund", [
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
    zeroAddress,
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
