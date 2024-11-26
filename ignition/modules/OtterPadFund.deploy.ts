/**
 * 
 * 
# Using mock tokens (default)
npx hardhat ignition deploy ./ignition/modules/OtterPadFund.deploy.ts --network hardhat
npx hardhat ignition deploy ./ignition/modules/OtterPadFund.deploy.ts --network sepolia  --verify
npx hardhat ignition deploy ./ignition/modules/OtterPadFund.deploy.ts --network polygon  --verify
npx hardhat ignition deploy ./ignition/modules/OtterPadFund.deploy.ts --network base  --verify

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

const DEFAULT_START_PRICE = parseUnits("0.01", 6); // 0.01 PAY
const DEFAULT_END_PRICE = parseUnits("0.03", 6); // 0.03 PAY
const DEFAULT_TARGET = parseUnits("1333333", 6); // 1.3M PAY
const DEFAULT_UPFRONT_RAKE_BPS = 30_000_000n; // 30%
const DEFAULT_ESCROW_RAKE_BPS = 0n; // 0%

// Hardhat Sepolia Fork
// const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"; // Mainnet V2 Factory

// Sepolia
// const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"; // Mainnet V2 Factory

// Polygon
// const UNISWAP_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C"; // Mainnet V2 Factory

// Base
const UNISWAP_ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"; // Mainnet V2 Router
const UNISWAP_FACTORY = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6"; // Mainnet V2 Factory

export default buildModule("OtterPadFundraiserModule", (m) => {
  // Get parameters with defaults
  const useMockTokens = m.getParameter("useMockTokens", true);
  const saleTokenAddress = m.getParameter<string>(
    "saleToken",
    // "0xb39abe0fB525Fc930a67d7B8D6Ea849162cac87C" // hardhat $BEANS
    // "0xa7E044179fB5143DF0Bd408599dBa37E275D9917" // sepolia $WINGS
    // "0xa9A1fA4f13f58E38AF86E7EC4669cfb7f85e7704" // polygon $WINGS
    "0xea0D03c0aBc36a1Ca7864e03f2E40333D6F4D0F4" // base $BEANS
  );
  const paymentTokenAddress = m.getParameter<string>(
    "paymentToken",
    // "0xdb537E5Be1786b66962C3ceA537bA48c11EF427E" // hardhat $BEANS
    // "0x385Bcb72e579C7A7D4c9C42DC089733c1675EDE6" // sepolia $USDT
    // "0xc0f1fDc19F557b8A35ac6d3e58B6a4fee6E874CE" // polygon $USDT
    "0xE18f4828148dBDAdD17de6528042bD5CD9262B7d" // base $BEANS
  );
  const foundersWallet = m.getParameter<string>(
    "foundersWallet",
    "0x0114413DcDe03fd10519Fad67Bf38c455AE5F921"
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
  const factoryAddress = zeroAddress;
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
    factoryAddress,
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
