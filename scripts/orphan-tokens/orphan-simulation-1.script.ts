// npx hardhat run scripts/orphan-tokens/orphan-simulation-1.script.ts --network hardhat
/**
 *
 * This simulates 11 buyers with refunds in middle
 * 1st buyer buys 5x 10k USDT
 * 9 buyers buy 100k USDT each and refund
 * 1st buyer buys 5x 10k USDT
 * Final buyer buys remaining amount
 *
 * We are left with no orphaned tokens, actually we are short a bit but our 1 SALE token buffer is there
 *
 */

import { parseUnits } from "viem";
import hre from "hardhat";

async function main() {
  console.log("Starting test script...");

  // Get signers
  const [
    deployer,
    buyer1,
    buyer2,
    buyer3,
    buyer4,
    buyer5,
    buyer6,
    buyer7,
    buyer8,
    buyer9,
    buyer10,
  ] = await hre.viem.getWalletClients();

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
  // USDT: 2M each to buyers (20M total to cover all scenarios)
  const usdtAmount = parseUnits("2000000", 6);
  const buyers = [
    buyer1,
    buyer2,
    buyer3,
    buyer4,
    buyer5,
    buyer6,
    buyer7,
    buyer8,
    buyer9,
    buyer10,
  ];

  for (const buyer of buyers) {
    await usdt.write.mint([buyer.account.address, usdtAmount]);
  }

  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Mainnet V2 Router
  const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"; // Mainnet V2 Factory

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

  // Buyer 1's 5 purchases of 10k each
  console.log("\nBuyer 1's first five 10k USDT purchases:");
  const smallAmount = parseUnits("10000", 6);
  for (let i = 0; i < 5; i++) {
    await buyerContracts[0].usdt.write.approve([
      fundraiser.address,
      smallAmount,
    ]);
    await buyerContracts[0].fundraiser.write.buy([
      smallAmount,
      buyer1.account.address,
    ]);
    console.log(`Purchase #${i} completed: 10k USDT`);
  }

  // 9 buyers purchasing 100k each
  console.log("\nNine buyers purchasing 100k USDT each:");
  const largeAmount = parseUnits("100000", 6);
  for (let i = 1; i < 10; i++) {
    await buyerContracts[i].usdt.write.approve([
      fundraiser.address,
      largeAmount,
    ]);
    await buyerContracts[i].fundraiser.write.buy([
      largeAmount,
      buyers[i].account.address,
    ]);
    console.log(`Buyer ${i + 1}'s purchase completed: 100k USDT`);
  }

  // Store order indices for refunds
  const orderIndices = await Promise.all(
    buyers.slice(1, 10).map(async (buyer) => {
      return await fundraiser.read.getUserOrderIndices([buyer.account.address]);
    })
  );

  // 9 buyers refunding their 100k orders
  console.log("\nNine buyers refunding their 100k USDT purchases:");
  for (let i = 0; i < 9; i++) {
    await buyerContracts[i + 1].fundraiser.write.refund([orderIndices[i][0]]);
    console.log(`Buyer ${i + 2}'s refund completed`);
  }

  // Buyer 1's next 5 purchases of 10k each
  console.log("\nBuyer 1's next five 10k USDT purchases:");
  for (let i = 5; i < 10; i++) {
    await buyerContracts[0].usdt.write.approve([
      fundraiser.address,
      smallAmount,
    ]);
    await buyerContracts[0].fundraiser.write.buy([
      smallAmount,
      buyer1.account.address,
    ]);
    console.log(`Purchase #${i} completed: 10k USDT`);
  }

  // Final buyer purchasing remaining amount
  console.log("\nFinal purchase of remaining amount:");
  const remainingAmount = await fundraiser.read.calculateRemainingAmount();
  console.log("Remaining amount to purchase:", remainingAmount);

  await buyerContracts[9].usdt.write.approve([
    fundraiser.address,
    remainingAmount,
  ]);
  await buyerContracts[9].fundraiser.write.buy([
    remainingAmount,
    buyer10.account.address,
  ]);
  console.log("Final purchase completed");

  // Deploy to DEX
  console.log("\nDeploying to DEX:");
  await fundraiser.write.deployToUniswap();
  console.log("Deployed to DEX");

  // Redeem tokens for non-refunded purchases
  console.log("\nRedeeming tokens for valid purchases:");

  // Buyer 1's redemptions (all 10 purchases)
  console.log("\nRedeeming Buyer 1's purchases:");
  const buyer1Orders = await fundraiser.read.getUserOrderIndices([
    buyer1.account.address,
  ]);
  for (let orderIndex of buyer1Orders) {
    try {
      await buyerContracts[0].fundraiser.write.redeem([orderIndex]);
      console.log(`Buyer 1 redeemed order ${orderIndex}`);
    } catch (e) {
      console.error(`Failed to redeem Buyer 1's order ${orderIndex}:`, e);
    }
  }

  // Final buyer redemption using order counter
  console.log("\nRedeeming Final Buyer's purchase:");
  const lastOrderId = (await fundraiser.read.orderCounter()) - 1n;
  try {
    await buyerContracts[9].fundraiser.write.redeem([lastOrderId]);
    console.log(`Final buyer redemption completed for order ${lastOrderId}`);
  } catch (e) {
    console.error(`Failed to redeem final buyer's order ${lastOrderId}:`, e);
  }

  // Log final state
  console.log("\nFinal State:");
  const remainingSaleTokens = await sale.read.balanceOf([fundraiser.address]);
  console.log("Remaining unredeemed SALE tokens:", remainingSaleTokens);

  // Log final allocations and balances for all buyers
  console.log("\nFinal Allocations and Balances:");
  for (let i = 0; i < buyers.length; i++) {
    const allocation = await fundraiser.read.getAllocation([
      buyers[i].account.address,
    ]);
    const saleBalance = await sale.read.balanceOf([buyers[i].account.address]);
    console.log(`Buyer ${i + 1}:`);
    console.log(`  Allocation: ${allocation}`);
    console.log(`  SALE Balance: ${saleBalance}`);
  }

  // Log contract balances
  const contractUSDTBalance = await usdt.read.balanceOf([fundraiser.address]);
  const contractSALEBalance = await sale.read.balanceOf([fundraiser.address]);
  console.log("\nContract Balances:");
  console.log(`USDT Balance: ${contractUSDTBalance}`);
  console.log(`SALE Balance: ${contractSALEBalance}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
