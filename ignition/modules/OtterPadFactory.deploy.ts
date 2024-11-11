// npx hardhat ignition deploy ./ignition/modules/OtterPadFactory.deploy.ts
// npx hardhat ignition deploy ./ignition/modules/OtterPadFactory.deploy.ts --network sepolia  --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Sepolia
// const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"; // Mainnet V2 Factory

// Arbitrum
// const UNISWAP_ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9"; // Mainnet V2 Factory

// Polygon
const UNISWAP_ROUTER = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"; // Mainnet V2 Router
const UNISWAP_FACTORY = "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C"; // Mainnet V2 Factory

// ________
// const UNISWAP_ROUTER = "___________"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "________"; // Mainnet V2 Factory

// ________
// const UNISWAP_ROUTER = "___________"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "________"; // Mainnet V2 Factory

// ________
// const UNISWAP_ROUTER = "___________"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "________"; // Mainnet V2 Factory

// ________
// const UNISWAP_ROUTER = "___________"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "________"; // Mainnet V2 Factory

// ________
// const UNISWAP_ROUTER = "___________"; // Mainnet V2 Router
// const UNISWAP_FACTORY = "________"; // Mainnet V2 Factory

export default buildModule("OtterPadFactoryModule", (m) => {
  // Deploy the factory contract
  const factory = m.contract("OtterPadFactory", [
    UNISWAP_ROUTER,
    UNISWAP_FACTORY,
  ]);

  return { factory };
});
