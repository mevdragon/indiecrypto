// npx hardhat run scripts/debug-fundraiser.script.ts --network hardhat

import { parseUnits } from "viem";
import hre from "hardhat";

async function main() {
  console.log("Starting debug script...");

  // Get signers
  const [deployer, founder, buyer1, buyer2, buyer3, buyer4, buyer5] =
    await hre.viem.getWalletClients();

  console.log("Deploying tokens...");

  // Deploy USDT (6 decimals)
  const usdt = await hre.viem.deployContract("MockERC20", ["USDT", "USDT", 6n]);
  console.log("USDT deployed at:", usdt.address);

  // Deploy WINGS (18 decimals)
  const wings = await hre.viem.deployContract("MockERC20", [
    "WINGS",
    "WINGS",
    18n,
  ]);
  console.log("WINGS deployed at:", wings.address);

  // Mint initial supplies
  // USDT: 20M each to buyers (100M total)
  const usdtAmount = parseUnits("20000000", 6);
  await usdt.write.mint([buyer1.account.address, usdtAmount]);
  await usdt.write.mint([buyer2.account.address, usdtAmount]);
  await usdt.write.mint([buyer3.account.address, usdtAmount]);
  await usdt.write.mint([buyer4.account.address, usdtAmount]);
  await usdt.write.mint([buyer5.account.address, usdtAmount]);

  // WINGS: 210M to founder
  const wingsAmount = parseUnits("210000000", 18);
  await wings.write.mint([founder.account.address, wingsAmount]);

  console.log("Tokens minted successfully");

  // Deploy Fundraiser
  const fundraiser = await hre.viem.deployContract("OtterPadFund", [
    "WINGS Sale", // title
    "https://example.com/info", // richInfoUrl
    wings.address, // saleToken
    usdt.address, // paymentToken
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap Router (mainnet)
    "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", // Uniswap Factory (mainnet)
    parseUnits("0.01", 6), // startPrice (0.01 USDT)
    parseUnits("0.03", 6), // endPrice (0.03 USDT)
    parseUnits("1333333.333333", 6), // targetLiquidity
    33_333_333n, // upfrontRakeBPS (33.3333%)
    0n, // escrowRakeBPS (0%)
    founder.account.address, // foundersWallet
    founder.account.address, // lpLockWallet
  ]);

  console.log("Fundraiser deployed at:", fundraiser.address);

  // Transfer required WINGS to fundraiser
  const requiredTokens = await fundraiser.read.checkSaleTokensRequired();
  const founderWings = await hre.viem.getContractAt(
    "MockERC20",
    wings.address,
    {
      client: { wallet: founder },
    }
  );
  await founderWings.write.transfer([fundraiser.address, requiredTokens]);

  console.log("\nStarting purchases...");

  // Setup buyer contracts
  const buyer1Usdt = await hre.viem.getContractAt("MockERC20", usdt.address, {
    client: { wallet: buyer1 },
  });
  const buyer1Fundraiser = await hre.viem.getContractAt(
    "OtterPadFund",
    fundraiser.address,
    {
      client: { wallet: buyer1 },
    }
  );

  const buyer2Usdt = await hre.viem.getContractAt("MockERC20", usdt.address, {
    client: { wallet: buyer2 },
  });
  const buyer2Fundraiser = await hre.viem.getContractAt(
    "OtterPadFund",
    fundraiser.address,
    {
      client: { wallet: buyer2 },
    }
  );

  const buyer3Usdt = await hre.viem.getContractAt("MockERC20", usdt.address, {
    client: { wallet: buyer3 },
  });
  const buyer3Fundraiser = await hre.viem.getContractAt(
    "OtterPadFund",
    fundraiser.address,
    {
      client: { wallet: buyer3 },
    }
  );

  // Step 1: Buyer 1 buys 10k USDT worth
  console.log("\n1. Buyer 1 purchasing 10k USDT worth:");
  const amount1 = parseUnits("10000", 6);
  await buyer1Usdt.write.approve([fundraiser.address, amount1]);
  await buyer1Fundraiser.write.buy([amount1, buyer1.account.address]);

  console.log("Current price:", await fundraiser.read.getCurrentPrice());
  console.log(
    "Total active contributions:",
    await fundraiser.read.totalActiveContributions()
  );
  console.log(
    "Buyer 1 allocation:",
    await fundraiser.read.getAllocation([buyer1.account.address])
  );

  // Step 2: Buyer 2 buys 900k USDT worth
  console.log("\n2. Buyer 2 purchasing 900k USDT worth:");
  console.log(
    "Buyer 2 allocation BEFORE purchase:",
    await fundraiser.read.getAllocation([buyer2.account.address])
  );

  const amount2 = parseUnits("900000", 6);
  await buyer2Usdt.write.approve([fundraiser.address, amount2]);
  await buyer2Fundraiser.write.buy([amount2, buyer2.account.address]);

  // Store Buyer 2's purchase details for comparison
  const buyer2Orders = await fundraiser.read.getUserOrderIndices([
    buyer2.account.address,
  ]);
  const buyer2Purchase = await fundraiser.read.purchases([buyer2Orders[0]]);

  console.log("\nAfter Buyer 2's purchase:");
  console.log("Current price:", await fundraiser.read.getCurrentPrice());
  console.log(
    "Total active contributions:",
    await fundraiser.read.totalActiveContributions()
  );
  console.log(
    "Buyer 2 allocation AFTER purchase:",
    await fundraiser.read.getAllocation([buyer2.account.address])
  );
  console.log("Buyer 2 purchase token amount:", buyer2Purchase[2]);

  // Step 3: Buyer 2 refunds 900k purchase
  console.log("\n3. Buyer 2 refunding 900k USDT purchase:");
  console.log(
    "Buyer 2 allocation BEFORE refund:",
    await fundraiser.read.getAllocation([buyer2.account.address])
  );

  await buyer2Fundraiser.write.refund([buyer2Orders[0]]);

  console.log("\nAfter Buyer 2's refund:");
  console.log("Current price:", await fundraiser.read.getCurrentPrice());
  console.log(
    "Total active contributions:",
    await fundraiser.read.totalActiveContributions()
  );
  console.log(
    "Buyer 2 allocation AFTER refund:",
    await fundraiser.read.getAllocation([buyer2.account.address])
  );

  // Step 4: Buyer 3 buys 900k USDT worth
  console.log("\n4. Buyer 3 purchasing 900k USDT worth:");
  console.log(
    "Buyer 3 allocation BEFORE purchase:",
    await fundraiser.read.getAllocation([buyer3.account.address])
  );

  const amount3 = parseUnits("900000", 6);
  await buyer3Usdt.write.approve([fundraiser.address, amount3]);
  await buyer3Fundraiser.write.buy([amount3, buyer3.account.address]);

  const buyer3Orders = await fundraiser.read.getUserOrderIndices([
    buyer3.account.address,
  ]);
  const buyer3Purchase = await fundraiser.read.purchases([buyer3Orders[0]]);

  console.log("\nAfter Buyer 3's purchase:");
  console.log("Current price:", await fundraiser.read.getCurrentPrice());
  console.log(
    "Total active contributions:",
    await fundraiser.read.totalActiveContributions()
  );
  console.log(
    "Buyer 3 allocation AFTER purchase:",
    await fundraiser.read.getAllocation([buyer3.account.address])
  );
  console.log("Buyer 3 purchase token amount:", buyer3Purchase[2]);

  // Compare allocations for the 900k purchases
  console.log("\nComparing 900k USDT purchases:");
  console.log("Buyer 2's purchase amount:", buyer2Purchase[2]);
  console.log("Buyer 3's purchase amount:", buyer3Purchase[2]);

  const tokenDifference = buyer2Purchase[2] - buyer3Purchase[2];
  const percentageDiff =
    Number((tokenDifference * 10000n) / buyer2Purchase[2]) / 100;

  console.log("\nAllocation Analysis:");
  console.log(`Token difference (Buyer2 - Buyer3): ${tokenDifference}`);
  console.log(`Percentage difference: ${percentageDiff}%`);

  if (tokenDifference > 0n) {
    console.log(
      "Buyer 2 received more tokens for the same USDT amount due to lower price at time of purchase"
    );
  } else if (tokenDifference < 0n) {
    console.log(
      "Buyer 3 received more tokens for the same USDT amount due to lower price after refund"
    );
  } else {
    console.log("Both buyers received the same amount of tokens");
  }

  // Show final allocations summary
  console.log("\nFinal Allocations Summary:");
  console.log(
    "Buyer 1:",
    await fundraiser.read.getAllocation([buyer1.account.address])
  );
  console.log(
    "Buyer 2:",
    await fundraiser.read.getAllocation([buyer2.account.address])
  );
  console.log(
    "Buyer 3:",
    await fundraiser.read.getAllocation([buyer3.account.address])
  );
  console.log(
    "Final total active contributions:",
    await fundraiser.read.totalActiveContributions()
  );
  console.log("Final price:", await fundraiser.read.getCurrentPrice());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
