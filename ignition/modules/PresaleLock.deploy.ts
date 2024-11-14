// npx hardhat ignition deploy ./ignition/modules/PresaleLock.deploy.ts
// npx hardhat ignition deploy ./ignition/modules/PresaleLock.deploy.ts --network sepolia  --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { zeroAddress } from "viem";

export default buildModule("PresaleLockModule", (m) => {
  // Get parameters with defaults
  const title = m.getParameter("title", "My PresaleLock");
  const foundersWallet = m.getParameter<string>(
    "foundersWallet",
    "0x0114413DcDe03fd10519Fad67Bf38c455AE5F921"
  );

  // Deploy the PresaleLock contract
  const presaleLock = m.contract("PresaleLock", [title, foundersWallet]);

  // // Set the fundraiser if addresses are provided
  // const otterpadFund = m.getParameter<string>("otterpadFund", zeroAddress);
  // const saleToken = m.getParameter<string>("saleToken", zeroAddress);
  // // @ts-ignore
  // if (otterpadFund !== zeroAddress && saleToken !== zeroAddress) {
  //   m.call(presaleLock, "setFundraiser", [otterpadFund, saleToken]);
  // }

  return { presaleLock };
});
