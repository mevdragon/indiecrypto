// npx hardhat ignition deploy ./ignition/modules/MockERC20.ts --network sepolia --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const RECIPIENT_ADDRESS = "0x1e8133a74C3Ed3669210860451BF4db2b9c25887";
const INITIAL_SUPPLY = parseEther("1000000"); // 1 million tokens with 18 decimals
const INITIAL_SUPPLY_PAY = 100_000_000_000_000; // 100 million tokens with 6 decimals

const TokenDeploymentModule = buildModule("TokenDeploymentModule", (m) => {
  // Deploy SALE token
  // const saleToken = m.contract("MockERC20", ["Sale Token", "SALE", 18n], {
  //   id: "SaleTokenMock",
  // });
  const saleToken = m.contract(
    "MockERC20",
    ["Rare Coffee Beans", "BEANS", 18n],
    {
      id: "CoffeeBeans",
    }
  );

  // Deploy PAY token
  // const payToken = m.contract("MockERC20", ["Payment Token", "PAY", 6n], {
  //   id: "PayTokenMock",
  // });
  const payToken = m.contract("MockERC20", ["USDC", "USDC", 6n], {
    id: "USDC",
  });

  // Mint SALE tokens after deployment
  m.call(saleToken, "mint", [RECIPIENT_ADDRESS, INITIAL_SUPPLY], {
    id: "mintSaleTokens",
  });

  // Mint PAY tokens after deployment
  m.call(payToken, "mint", [RECIPIENT_ADDRESS, INITIAL_SUPPLY_PAY], {
    id: "mintPayTokens",
  });

  // Return only the contract deployments
  return {
    saleToken,
    payToken,
  };
});

export default TokenDeploymentModule;
