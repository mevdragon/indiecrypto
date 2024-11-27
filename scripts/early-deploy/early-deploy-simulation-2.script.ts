// npx hardhat run scripts/early-deploy/early-deploy-simulation-2.script.ts --network hardhat

/**
 * This script simulates a premature deployment scenario with $1.8M from 9 buyers & middle refunds to net $600k raised
 * Results in 3.81% orphaned tokens.
 */

import { parseUnits, formatUnits } from "viem";
import hre from "hardhat";

async function main() {
  console.log("Starting premature deployment analysis...");

  // Setup wallets and initial state tracking
  const [deployer, ...buyers] = await hre.viem.getWalletClients();

  // Match the contract's Purchase struct
  type PurchaseRecord = [
    paymentAmount: bigint, // [0] Total amount paid by user in payment token wei
    contributionAmount: bigint, // [1] Amount towards liquidity after upfront rake, escrow rake, and otterpad fee
    tokenAmount: bigint, // [2] Calculated token to be received in wei
    purchaser: string, // [3] Address of the purchaser
    recipient: string, // [4] Address of the recipient
    isRefunded: boolean, // [5] Whether the purchase was refunded
    isRedeemed: boolean, // [6] Whether the purchase was redeemed
    purchaseBlock: bigint, // [7] Block number of the purchase
    orderIndex: bigint // [8] Order index
  ];

  // Additional tracking for our analysis
  interface PurchaseAnalysis {
    purchaseRecord: PurchaseRecord;
    buyerNumber: number;
    wasRefunded: boolean;
    redemptionStats?: {
      originalTokenAmount: bigint;
      bonusProratedTokenAmount: bigint;
      totalTokensReceived: bigint;
      avgPrice: bigint;
    };
  }

  const purchaseAnalysis: PurchaseAnalysis[] = [];

  // Deploy contracts
  console.log("\n1. Deploying Contracts...");
  const usdt = await hre.viem.deployContract("MockERC20", ["USDT", "USDT", 6n]);
  const sale = await hre.viem.deployContract("MockERC20", [
    "SALE",
    "SALE",
    18n,
  ]);

  // Mint USDT to buyers
  const usdtAmount = parseUnits("10000000", 6); // 10M USDT each
  for (const buyer of buyers) {
    await usdt.write.mint([buyer.account.address, usdtAmount]);
  }

  // Deploy Fundraiser
  const fundraiser = await hre.viem.deployContract("OtterPadFund", [
    "SALE Token Premature Deploy Analysis",
    "https://example.com/info",
    sale.address,
    usdt.address,
    "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3", // Router
    "0xF62c03E08ada871A0bEb309762E260a7a6a880E6", // Factory
    parseUnits("0.01", 6), // startPrice
    parseUnits("0.03", 6), // endPrice
    parseUnits("1333333.333333", 6), // targetLiquidity
    22222222n, // upfrontRakeBPS
    11111111n, // escrowRakeBPS
    deployer.account.address,
    deployer.account.address,
    deployer.account.address,
  ]);

  // Mint and transfer required SALE tokens
  const [requiredTokens] = await fundraiser.read.checkSaleTokensRequired();
  await sale.write.mint([deployer.account.address, requiredTokens]);
  await sale.write.transfer([fundraiser.address, requiredTokens]);

  // Setup buyer contracts
  const buyerContracts = await Promise.all(
    buyers.map(async (buyer) => ({
      usdt: await hre.viem.getContractAt("MockERC20", usdt.address, {
        client: { wallet: buyer },
      }),
      fundraiser: await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer } }
      ),
    }))
  );

  // Calculate purchase amount (10% each)
  const targetRaise = parseUnits("2000000", 6);
  const purchaseAmount = targetRaise / 10n;

  console.log("\n2. Executing Purchases...");
  // First 9 buyers purchase 10% each
  for (let i = 0; i < 9; i++) {
    await buyerContracts[i].usdt.write.approve([
      fundraiser.address,
      purchaseAmount,
    ]);
    await buyerContracts[i].fundraiser.write.buy([
      purchaseAmount,
      buyers[i].account.address,
    ]);

    const orderIndices = await fundraiser.read.getUserOrderIndices([
      buyers[i].account.address,
    ]);
    const purchase = await fundraiser.read.purchases([orderIndices[0]]);

    purchaseAnalysis.push({
      purchaseRecord: purchase,
      buyerNumber: i + 1,
      wasRefunded: false,
    });
  }

  // Process refunds for buyers 3-4
  console.log("\n3. Processing Refunds...");
  for (let i = 2; i < 7; i++) {
    const orderIndices = await fundraiser.read.getUserOrderIndices([
      buyers[i].account.address,
    ]);
    await buyerContracts[i].fundraiser.write.refund([orderIndices[0]]);
    purchaseAnalysis[i].wasRefunded = true;
  }

  // Execute premature deploy
  console.log("\n4. Executing Premature Deploy...");
  const deployerFundraiser = await hre.viem.getContractAt(
    "OtterPadFund",
    fundraiser.address,
    {
      client: { wallet: deployer },
    }
  );
  await deployerFundraiser.write.prematureDeployToUniswap();

  // Process redemptions and update final token amounts
  console.log("\n5. Processing Redemptions...");
  for (let i = 0; i < 10; i++) {
    const orderIndices = await fundraiser.read.getUserOrderIndices([
      buyers[i].account.address,
    ]);
    try {
      await buyerContracts[i].fundraiser.write.redeem([orderIndices[0]]);

      const received = await fundraiser.read.received([orderIndices[0]]);
      purchaseAnalysis[i].redemptionStats = {
        originalTokenAmount: received[3],
        bonusProratedTokenAmount: received[4],
        totalTokensReceived: received[5],
        avgPrice: received[6],
      };
    } catch (e) {
      console.log(`Error on buyer`);
    }
  }

  // Calculate total token supply and ownership percentages
  const uniswapPool = await fundraiser.read.uniswapPool();
  const pool = await hre.viem.getContractAt("IUniswapV2Pair", uniswapPool);
  const reserves = await pool.read.getReserves();
  const totalSupply =
    reserves[0] +
    purchaseAnalysis.reduce(
      (acc, p) => acc + (p.redemptionStats?.totalTokensReceived || 0n),
      0n
    );

  // Generate analysis report
  console.log("\n=== Premature Deploy Analysis Report ===");
  console.log("\nInitial Parameters:");
  console.log(`Target Raise: ${formatUnits(targetRaise, 6)} USDT`);
  console.log(
    `Purchase Size: ${formatUnits(purchaseAmount, 6)} USDT (10% each)`
  );

  console.log("\nPurchase & Redemption Analysis:");
  console.log("--------------------------------");
  for (const analysis of purchaseAnalysis) {
    // console.log(`analysis`, analysis);
    if (analysis.wasRefunded) {
      console.log(`\nBuyer ${analysis.buyerNumber} (REFUNDED)`);
      console.log(
        `├─ Payment: ${formatUnits(analysis.purchaseRecord[0], 6)} USDT`
      );
      console.log(
        `├─ Contribution Amount: ${formatUnits(
          analysis.purchaseRecord[1],
          6
        )} USDT`
      );
      console.log(`└─ Status: Fully Refunded`);
    } else if (analysis.redemptionStats) {
      const originalPct =
        Number(
          (analysis.redemptionStats.originalTokenAmount * 10000n) /
            analysis.redemptionStats.totalTokensReceived
        ) / 100;
      const bonusPct =
        Number(
          (analysis.redemptionStats.bonusProratedTokenAmount * 10000n) /
            analysis.redemptionStats.totalTokensReceived
        ) / 100;
      const supplyPct =
        Number(
          (analysis.redemptionStats.totalTokensReceived * 10000n) / totalSupply
        ) / 100;

      console.log(`\nBuyer ${analysis.buyerNumber}`);
      console.log(
        `├─ Payment: ${formatUnits(analysis.purchaseRecord[0], 6)} USDT`
      );
      console.log(
        `├─ Contribution Amount: ${formatUnits(
          analysis.purchaseRecord[1],
          6
        )} USDT`
      );
      console.log(
        `├─ Original Tokens: ${formatUnits(
          analysis.redemptionStats.originalTokenAmount,
          18
        )} (${originalPct.toFixed(2)}% of their total)`
      );
      console.log(
        `├─ Bonus Tokens: ${formatUnits(
          analysis.redemptionStats.bonusProratedTokenAmount,
          18
        )} (${bonusPct.toFixed(2)}% of their total)`
      );
      console.log(
        `├─ Total Tokens: ${formatUnits(
          analysis.redemptionStats.totalTokensReceived,
          18
        )} (${supplyPct.toFixed(2)}% of supply)`
      );
      console.log(
        `└─ Effective Price: ${formatUnits(
          analysis.redemptionStats.avgPrice,
          6
        )} USDT/token`
      );
    }
  }

  console.log("\nLiquidity Pool Status:");
  console.log("----------------------");
  const lpPct = Number((reserves[0] * 10000n) / totalSupply) / 100;
  console.log(
    `SALE Tokens: ${formatUnits(reserves[0], 18)} (${lpPct.toFixed(
      2
    )}% of supply)`
  );
  console.log(`USDT: ${formatUnits(reserves[1], 6)}`);

  console.log("\nTotal Supply Distribution:");
  console.log("-------------------------");
  const activeHolders = purchaseAnalysis.filter((p) => !p.wasRefunded);
  const holdersPct = 100 - lpPct;
  const avgHolderPct = holdersPct / activeHolders.length;
  // Check orphaned tokens in fundraiser
  const orphanedTokens = await sale.read.balanceOf([fundraiser.address]);
  const orphanedPct = Number((orphanedTokens * 10000n) / totalSupply) / 100;

  console.log(`Total Supply: ${formatUnits(totalSupply, 18)} SALE`);
  console.log(
    `└─ Orphaned in Fundraiser: ${formatUnits(
      orphanedTokens,
      18
    )} (${orphanedPct.toFixed(2)}%)`
  );
  console.log(`├─ Liquidity Pool: ${lpPct.toFixed(2)}%`);
  console.log(`└─ Token Holders: ${holdersPct.toFixed(2)}%`);
  console.log(`    └─ Average per holder: ${avgHolderPct.toFixed(2)}%`);

  // Additional useful ratios
  const totalContributed = purchaseAnalysis.reduce(
    (acc, p) => acc + p.purchaseRecord[1],
    0n
  );
  const effectivePrice = (totalContributed * 10n ** 18n) / totalSupply;

  console.log("\nKey Metrics:");
  console.log("------------");
  console.log(
    `Total USDT Contributed: ${formatUnits(totalContributed, 6)} USDT`
  );
  console.log(
    `Effective Price Per Token: ${formatUnits(effectivePrice, 6)} USDT`
  );
  console.log(
    `Bonus Token Multiplier: ${(
      Number(
        (totalSupply * 10000n) /
          purchaseAnalysis.reduce((acc, p) => acc + p.purchaseRecord[2], 0n)
      ) / 100
    ).toFixed(2)}x`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
