// npx hardhat run scripts/orphan-tokens/orphan-simulation-4.script.ts --network hardhat
/**
 * Similar to Simulation 2 but with more refunds
 *
 * This simulates an extra large refund scenario with orphaned tokens
 * 1st buyer buys 600k USDT + 600k USDT + 600k USDT but refunds all but the last 600k USDT
 * 2nd buyer buys 600k USDT
 * 3rd buyer buys remaining amount
 *
 * We are left with 19.4M orphaned tokens (19.4% of total 100M tokens allocated for buyers)
 * This reflects how more refunds can lead to more orphaned tokens
 *
 */

import { parseUnits, zeroAddress } from "viem";
import hre from "hardhat";

async function main() {
  console.log("Starting test script...");

  // Get signers
  const [deployer, buyer1, buyer2, buyer3] = await hre.viem.getWalletClients();

  console.log("Deploying tokens...");

  // Deploy USDT (6 decimals)
  const usdt = await hre.viem.deployContract("MockERC20", ["USDT", "USDT", 6n]);
  console.log("USDT deployed at:", usdt.address);

  // Deploy SALE token (18 decimals)
  const sale = await hre.viem.deployContract("MockERC20", [
    "SALE",
    "SALE",
    18n,
  ]);
  console.log("SALE deployed at:", sale.address);

  // Mint initial supplies
  // USDT: 2M each to buyers
  const usdtAmount = parseUnits("2000000", 6);
  const buyers = [buyer1, buyer2, buyer3];

  for (const buyer of buyers) {
    await usdt.write.mint([buyer.account.address, usdtAmount]);
  }

  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";
  const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6";

  // Deploy Fundraiser with specified parameters
  const fundraiser = await hre.viem.deployContract("OtterPadFund", [
    "SALE Token Sale",
    "https://example.com/info",
    sale.address,
    usdt.address,
    UNISWAP_ROUTER,
    UNISWAP_FACTORY,
    parseUnits("0.01", 6), // startPrice
    parseUnits("0.03", 6), // endPrice
    parseUnits("1333333.333333", 6), // targetLiquidity
    22222222n, // upfrontRakeBPS
    11111111n, // escrowRakeBPS
    deployer.account.address, // foundersWallet
    deployer.account.address, // lpLockWallet
    zeroAddress, // factory mock
  ]);

  console.log("Fundraiser deployed at:", fundraiser.address);

  // Transfer required SALE tokens to fundraiser
  const requiredTokens = await fundraiser.read.checkSaleTokensRequired();
  console.log("Required SALE tokens for sale:", requiredTokens);
  await sale.write.mint([deployer.account.address, requiredTokens[0]]);
  const deployerSale = await hre.viem.getContractAt("MockERC20", sale.address, {
    client: { wallet: deployer },
  });
  await deployerSale.write.transfer([fundraiser.address, requiredTokens[0]]);

  // Setup buyer contracts
  const buyerContracts = await Promise.all(
    buyers.map(async (buyer) => {
      const usdtContract = await hre.viem.getContractAt(
        "MockERC20",
        usdt.address,
        {
          client: { wallet: buyer },
        }
      );
      const fundraiserContract = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        {
          client: { wallet: buyer },
        }
      );
      return { usdt: usdtContract, fundraiser: fundraiserContract };
    })
  );

  // P0: Buyer 1's first 600k purchase
  console.log("\nP0: Buyer 1's first 600k USDT purchase");
  const amount600k = parseUnits("600000", 6);
  await buyerContracts[0].usdt.write.approve([fundraiser.address, amount600k]);
  await buyerContracts[0].fundraiser.write.buy([
    amount600k,
    buyer1.account.address,
  ]);
  console.log("P0 completed");

  // P1: Buyer 1's second 600k purchase
  console.log("\nP1: Buyer 1's second 600k USDT purchase");
  await buyerContracts[0].usdt.write.approve([fundraiser.address, amount600k]);
  await buyerContracts[0].fundraiser.write.buy([
    amount600k,
    buyer1.account.address,
  ]);
  console.log("P1 completed");

  // P2: Buyer 1's third 600k purchase
  console.log("\nP1: Buyer 1's second 600k USDT purchase");
  await buyerContracts[0].usdt.write.approve([fundraiser.address, amount600k]);
  await buyerContracts[0].fundraiser.write.buy([
    amount600k,
    buyer1.account.address,
  ]);
  console.log("P2 completed");

  // Buyer 1 refunds P0
  console.log("\nBuyer 1 refunding P0");
  const buyer1Orders = await fundraiser.read.getUserOrderIndices([
    buyer1.account.address,
  ]);
  await buyerContracts[0].fundraiser.write.refund([buyer1Orders[0]]);
  console.log("P0 refund completed");

  // Buyer 1 refunds P1
  console.log("\nBuyer 1 refunding P1");
  await buyerContracts[0].fundraiser.write.refund([buyer1Orders[1]]);
  console.log("P1 refund completed");

  // P3: Buyer 2's 600k purchase
  console.log("\nP3: Buyer 2's 600k USDT purchase");
  await buyerContracts[1].usdt.write.approve([fundraiser.address, amount600k]);
  await buyerContracts[1].fundraiser.write.buy([
    amount600k,
    buyer2.account.address,
  ]);
  console.log("P3 completed");

  // P4: Buyer 3's purchase of remaining amount
  console.log("\nP4: Buyer 3's purchase of remaining amount");
  const remainingAmount = await fundraiser.read.calculateRemainingAmount();
  console.log("Remaining amount to purchase:", remainingAmount);
  await buyerContracts[2].usdt.write.approve([
    fundraiser.address,
    remainingAmount,
  ]);
  await buyerContracts[2].fundraiser.write.buy([
    remainingAmount,
    buyer3.account.address,
  ]);
  console.log("P4 completed");

  // Deploy to DEX
  console.log("\nDeploying to DEX");
  await fundraiser.write.deployToUniswap();
  console.log("Deployed to DEX");

  // Redeem tokens for non-refunded purchases
  console.log("\nRedeeming tokens for valid purchases");

  // Buyer 1's P2 redemption
  console.log("Redeeming Buyer 1's P2");
  await buyerContracts[0].fundraiser.write.redeem([buyer1Orders[2]]);

  // Buyer 2's redemption
  console.log("Redeeming Buyer 2's purchase");
  const buyer2Orders = await fundraiser.read.getUserOrderIndices([
    buyer2.account.address,
  ]);
  await buyerContracts[1].fundraiser.write.redeem([buyer2Orders[0]]);

  // Buyer 3's redemption
  console.log("Redeeming Buyer 3's purchase");
  const buyer3Orders = await fundraiser.read.getUserOrderIndices([
    buyer3.account.address,
  ]);
  await buyerContracts[2].fundraiser.write.redeem([buyer3Orders[0]]);

  // Log final allocations and balances
  console.log("\nFinal Allocations vs SALE Token Balances:");

  for (let i = 0; i < buyers.length; i++) {
    const buyer = buyers[i];
    const allocation = await fundraiser.read.getAllocation([
      buyer.account.address,
    ]);
    const saleBalance = await sale.read.balanceOf([buyer.account.address]);
    console.log(`Buyer ${i + 1}:`);
    console.log(`  Allocation: ${allocation}`);
    console.log(`  SALE Balance: ${saleBalance}`);
  }

  // Log remaining SALE tokens in contract
  const remainingSale = await sale.read.balanceOf([fundraiser.address]);
  console.log("\nRemaining SALE tokens in contract:", remainingSale);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
