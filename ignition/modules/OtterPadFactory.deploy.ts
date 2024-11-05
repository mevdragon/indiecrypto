// npx hardhat ignition deploy ./ignition/modules/OtterPadFactory.deploy.ts
// npx hardhat ignition deploy ./ignition/modules/OtterPadFactory.deploy.ts --network sepolia  --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Mainnet V2 Router
const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"; // Mainnet V2 Factory

export default buildModule("OtterPadFactoryModule", (m) => {
  // Deploy the factory contract
  const factory = m.contract("OtterPadFactory", [
    UNISWAP_ROUTER,
    UNISWAP_FACTORY,
  ]);

  return { factory };
});
