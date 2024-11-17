// npx hardhat ignition deploy ./ignition/modules/PresaleLockFactory.deploy.ts
// npx hardhat ignition deploy ./ignition/modules/PresaleLockFactory.deploy.ts --network sepolia  --verify
// npx hardhat ignition deploy ./ignition/modules/PresaleLockFactory.deploy.ts --network polygon  --verify
// npx hardhat ignition deploy ./ignition/modules/PresaleLockFactory.deploy.ts --network base  --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("OtterPadFactoryModule", (m) => {
  // Deploy the factory contract
  const factory = m.contract("PresaleLockFactory", []);

  return { factory };
});
